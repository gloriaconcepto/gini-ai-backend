terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  frontend_cors_origins = var.enable_frontend ? join(",", [
    "https://${aws_cloudfront_distribution.frontend["client-portal"].domain_name}",
    "https://${aws_cloudfront_distribution.frontend["oem-backoffice"].domain_name}",
    "https://${aws_cloudfront_distribution.api[0].domain_name}"
  ]) : ""
  effective_cors_origins = var.cors_origins != "" ? (
    local.frontend_cors_origins != "" ? "${var.cors_origins},${local.frontend_cors_origins}" : var.cors_origins
  ) : local.frontend_cors_origins
}

# -----------------------------------------------------------------------------
# 1. NETWORKING: MULTI-AZ VPC & SUBNETS
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "vpc-${var.project_name}-${var.environment}"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "igw-${var.project_name}-${var.environment}"
  }
}

# Public Subnets (ALB & NAT Gateway)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "snet-public-${var.environment}-${count.index + 1}"
  }
}

# Private Application Subnets (ECS Fargate Services)
resource "aws_subnet" "private_app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "snet-app-${var.environment}-${count.index + 1}"
  }
}

# Private Database Subnets (RDS PostgreSQL & ElastiCache)
resource "aws_subnet" "private_db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "snet-db-${var.environment}-${count.index + 1}"
  }
}


# NAT Gateway for Outbound Internet Access from Private Subnets
resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "eip-nat-${var.project_name}-${var.environment}"
  }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "nat-${var.project_name}-${var.environment}"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "rt-public-${var.environment}"
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = {
    Name = "rt-private-${var.environment}"
  }
}

resource "aws_route_table_association" "app" {
  count          = 2
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "db" {
  count          = 2
  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private.id
}


# -----------------------------------------------------------------------------
# 2. SECURITY GROUPS
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Controls HTTP/HTTPS ingress to Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP Ingress"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS Ingress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Outbound to targets"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }
}

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-tasks-sg-${var.environment}"
  description = "Controls ingress to ECS Fargate tasks from ALB and within cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Gateway traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Keycloak traffic from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "Inter-service container communication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Controls database access from ECS Fargate tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }
}

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Controls ElastiCache Redis access from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis port from ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-redis-sg-${var.environment}"
  }
}

# -----------------------------------------------------------------------------
# 3. RELATIONAL DATABASE (Amazon RDS for PostgreSQL 16)
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "rds" {
  name       = "dbsng-${var.project_name}-${var.environment}"
  subnet_ids = aws_subnet.private_db[*].id

  tags = {
    Name = "dbsng-${var.project_name}-${var.environment}"
  }
}

resource "aws_db_parameter_group" "pg16" {
  name   = "pg16-${var.project_name}-${var.environment}"
  family = "postgres16"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "pg16-params-${var.environment}"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                 = "psql-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  engine                     = "postgres"
  engine_version             = var.rds_engine_version
  auto_minor_version_upgrade = true
  instance_class             = var.rds_instance_class
  allocated_storage          = 20
  max_allocated_storage      = var.rds_max_allocated_storage
  storage_type               = "gp3"
  apply_immediately          = true
  db_name                    = "ginidb"
  username                   = var.db_admin_username
  password                   = var.db_admin_password
  db_subnet_group_name       = aws_db_subnet_group.rds.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  parameter_group_name       = aws_db_parameter_group.pg16.name
  publicly_accessible        = false
  skip_final_snapshot        = true
  deletion_protection        = false

  tags = {
    Name = "psql-${var.project_name}-${var.environment}"
  }
}

# -----------------------------------------------------------------------------
# 4. CACHE & QUEUE BROKER (Amazon ElastiCache for Redis)
# -----------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "redis" {
  name       = "redis-sng-${var.project_name}-${var.environment}"
  subnet_ids = aws_subnet.private_db[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "redis-${var.project_name}-${var.environment}"
  description                = "Redis cluster for BullMQ queue and JWKS caching"
  node_type                  = "cache.t4g.micro"
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  parameter_group_name       = "default.redis7"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  tags = {
    Name = "redis-${var.project_name}-${var.environment}"
  }
}


# -----------------------------------------------------------------------------
# 6. CONTAINER REGISTRY (Amazon ECR)
# -----------------------------------------------------------------------------
locals {
  ecr_repositories = ["gateway", "workers", "keycloak"]
}

resource "aws_ecr_repository" "repos" {
  for_each             = toset(local.ecr_repositories)
  name                 = "${var.project_name}-${each.key}-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# -----------------------------------------------------------------------------
# 7. SECRETS & PARAMETERS (AWS Secrets Manager & SSM)
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.project_name}/${var.environment}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${aws_db_instance.postgres.endpoint}/ginidb"
}

resource "aws_secretsmanager_secret" "kc_admin_secret" {
  name                    = "${var.project_name}/${var.environment}/keycloak-admin-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "kc_admin_secret" {
  secret_id     = aws_secretsmanager_secret.kc_admin_secret.id
  secret_string = var.keycloak_admin_client_secret
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.project_name}/${var.environment}/db-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_admin_password
}

resource "aws_secretsmanager_secret" "kc_admin_password" {
  name                    = "${var.project_name}/${var.environment}/keycloak-admin-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "kc_admin_password" {
  secret_id     = aws_secretsmanager_secret.kc_admin_password.id
  secret_string = var.keycloak_admin_password
}

# -----------------------------------------------------------------------------
# 8. APPLICATION LOAD BALANCER & ECS CLUSTER
# -----------------------------------------------------------------------------
resource "aws_lb" "alb" {
  name                       = "alb-${var.project_name}-${var.environment}"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  xff_header_processing_mode = "preserve"

  tags = {
    Name = "alb-${var.project_name}-${var.environment}"
  }
}

resource "aws_lb_target_group" "gateway" {
  name        = "tg-gateway-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/docs"
    port                = "3000"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200-399"
  }
}

resource "aws_lb_target_group" "keycloak" {
  name        = "tg-keycloak-${var.environment}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/realms/master"
    port                = "8080"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 5
    matcher             = "200-399"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway.arn
  }
}

resource "aws_lb_listener_rule" "keycloak" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.keycloak.arn
  }

  condition {
    path_pattern {
      values = ["/auth/*", "/realms/*", "/resources/*", "/js/*", "/admin/*"]
    }
  }
}

resource "aws_ecs_cluster" "main" {
  name = "ecs-${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
    base              = 1
  }
}

# -----------------------------------------------------------------------------
# 9. IAM ROLES FOR ECS FARGATE TASKS
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution" {
  name = "role-ecs-task-execution-${var.environment}-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_policy" "secrets_read" {
  name        = "policy-ecs-secrets-read-${var.environment}-${random_string.suffix.result}"
  description = "Allows ECS tasks to read Secrets Manager secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameters"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.secrets_read.id
}

# Task Role (Grants Gateway & Workers permission to access external S3 document storage)
resource "aws_iam_role" "ecs_task" {
  name = "role-ecs-task-${var.environment}-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "ecs_task_permissions" {
  name        = "policy-ecs-task-permissions-${var.environment}-${random_string.suffix.result}"
  description = "Permissions for Gateway to access external S3 document storage"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3DocumentAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_document_bucket_name}",
          "arn:aws:s3:::${var.s3_document_bucket_name}/*"
        ]
      },
      {
        Sid    = "KMSEncryptionAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_attach" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_task_permissions.id
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/ecs/${var.project_name}-gateway-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "keycloak" {
  name              = "/ecs/${var.project_name}-keycloak-${var.environment}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "workers" {
  name              = "/ecs/${var.project_name}-workers-${var.environment}"
  retention_in_days = 30
}

# -----------------------------------------------------------------------------
# 10. ECS TASK DEFINITIONS & SERVICES
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "gateway" {
  family                   = "${var.project_name}-gateway-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "gateway"
      image     = "${aws_ecr_repository.repos["gateway"].repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "APP_ENV", value = "remote" },
        { name = "PORT", value = "3000" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "KEYCLOAK_URL", value = var.enable_frontend ? "https://${aws_cloudfront_distribution.api[0].domain_name}" : "http://${aws_lb.alb.dns_name}" },
        { name = "KEYCLOAK_ADMIN_CLIENT_ID", value = var.keycloak_admin_client_id },
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.redis.primary_endpoint_address },
        { name = "REDIS_PORT", value = "6379" },
        { name = "AWS_S3_BUCKET_NAME", value = var.s3_document_bucket_name },
        { name = "AWS_S3_REGION", value = var.aws_region },
        { name = "CORS_ORIGINS", value = local.effective_cors_origins },
        { name = "ALLOWED_ORIGINS", value = local.effective_cors_origins }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.db_url.arn
        },
        {
          name      = "KEYCLOAK_ADMIN_CLIENT_SECRET"
          valueFrom = aws_secretsmanager_secret.kc_admin_secret.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.gateway.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-gateway-task-${var.environment}"
  }
}

resource "aws_ecs_service" "gateway" {
  name            = "gateway-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.gateway.arn
  desired_count   = var.enable_scale_to_zero ? 0 : 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
    base              = 1
  }

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.gateway.arn
    container_name   = "gateway"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.http, aws_ecs_cluster_capacity_providers.main]

  tags = {
    Name = "${var.project_name}-gateway-service-${var.environment}"
  }
}

resource "aws_ecs_task_definition" "keycloak" {
  family                   = "${var.project_name}-keycloak-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name       = "keycloak"
      image      = "quay.io/keycloak/keycloak:24.0.0"
      entryPoint = ["/bin/sh", "-c"]
      command = [
        "/opt/keycloak/bin/kc.sh start-dev & KC_PID=$!; echo 'Waiting for Keycloak to start...'; until /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user \"$KEYCLOAK_ADMIN\" --password \"$KEYCLOAK_ADMIN_PASSWORD\"; do sleep 2; done; echo 'Configuring master realm sslRequired=NONE...'; /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE || true; echo 'Assigning admin role to user admin...'; /opt/keycloak/bin/kcadm.sh add-roles -r master --uusername \"$KEYCLOAK_ADMIN\" --rolename admin || true; echo 'Configuring Gateway admin client in master realm...'; if ! /opt/keycloak/bin/kcadm.sh get clients -r master -q clientId=gini-gateway-service | grep -q 'gini-gateway-service'; then /opt/keycloak/bin/kcadm.sh create clients -r master -s clientId=gini-gateway-service -s 'name=Gini AI Gateway Service' -s enabled=true -s clientAuthenticatorType=client-secret -s secret=\"$KEYCLOAK_ADMIN_CLIENT_SECRET\" -s serviceAccountsEnabled=true -s publicClient=false -s standardFlowEnabled=false -s directAccessGrantsEnabled=false; /opt/keycloak/bin/kcadm.sh add-roles -r master --uusername service-account-gini-gateway-service --rolename admin || true; fi; echo 'Keycloak initialization complete.'; wait $KC_PID"
      ]
      essential = true
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "KC_DB", value = "postgres" },
        { name = "KC_DB_URL", value = "jdbc:postgresql://${aws_db_instance.postgres.endpoint}/ginidb" },
        { name = "KC_DB_USERNAME", value = var.db_admin_username },
        { name = "KEYCLOAK_ADMIN", value = var.keycloak_admin_username },
        { name = "KC_PROXY_HEADERS", value = "xforwarded" },
        { name = "KC_HOSTNAME_STRICT", value = "false" },
        { name = "KC_HTTP_ENABLED", value = "true" }
      ]
      secrets = [
        {
          name      = "KC_DB_PASSWORD"
          valueFrom = aws_secretsmanager_secret.db_password.arn
        },
        {
          name      = "KEYCLOAK_ADMIN_PASSWORD"
          valueFrom = aws_secretsmanager_secret.kc_admin_password.arn
        },
        {
          name      = "KEYCLOAK_ADMIN_CLIENT_SECRET"
          valueFrom = aws_secretsmanager_secret.kc_admin_secret.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.keycloak.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-keycloak-task-${var.environment}"
  }
}

resource "aws_ecs_service" "keycloak" {
  name            = "keycloak-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.keycloak.arn
  desired_count   = var.enable_scale_to_zero ? 0 : 1

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
    base              = 1
  }

  health_check_grace_period_seconds = 180

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.keycloak.arn
    container_name   = "keycloak"
    container_port   = 8080
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener_rule.keycloak, aws_ecs_cluster_capacity_providers.main]

  tags = {
    Name = "${var.project_name}-keycloak-service-${var.environment}"
  }
}
