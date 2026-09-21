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

# Private Search Subnets (Amazon OpenSearch Service)
resource "aws_subnet" "private_search" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 6)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "snet-search-${var.environment}-${count.index + 1}"
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

resource "aws_route_table_association" "search" {
  count          = 2
  subnet_id      = aws_subnet.private_search[count.index].id
  route_table_id = aws_route_table.private.id
}

# -----------------------------------------------------------------------------
# 2. SECURITY GROUPS
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "sg-alb-${var.environment}"
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
    Name = "sg-alb-${var.environment}"
  }
}

resource "aws_security_group" "ecs" {
  name        = "sg-ecs-tasks-${var.environment}"
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
    Name = "sg-ecs-tasks-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "sg-rds-${var.environment}"
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
    Name = "sg-rds-${var.environment}"
  }
}

resource "aws_security_group" "redis" {
  name        = "sg-redis-${var.environment}"
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
    Name = "sg-redis-${var.environment}"
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
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name = "pg16-params-${var.environment}"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "psql-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  engine                 = "postgres"
  engine_version         = "16.4"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  db_name                = "ginidb"
  username               = var.db_admin_username
  password               = var.db_admin_password
  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = false

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
  replication_group_id = "redis-${var.project_name}-${var.environment}"
  description          = "Redis cluster for BullMQ queue and JWKS caching"
  node_type            = "cache.t4g.micro"
  num_cache_clusters   = 1
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
  parameter_group_name = "default.redis7"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false

  tags = {
    Name = "redis-${var.project_name}-${var.environment}"
  }
}

# -----------------------------------------------------------------------------
# 5. RAG DOCUMENT STORAGE (Amazon S3)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "rag_documents" {
  bucket        = "gini-ai-rag-documents-${var.environment}-${random_string.suffix.result}"
  force_destroy = true

  tags = {
    Name = "gini-ai-rag-documents-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "rag_documents" {
  bucket = aws_s3_bucket.rag_documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "rag_documents" {
  bucket = aws_s3_bucket.rag_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
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

# -----------------------------------------------------------------------------
# 8. APPLICATION LOAD BALANCER & ECS CLUSTER
# -----------------------------------------------------------------------------
resource "aws_lb" "alb" {
  name               = "alb-${var.project_name}-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

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

# -----------------------------------------------------------------------------
# 9. IAM ROLES FOR ECS FARGATE TASKS
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution" {
  name = "role-ecs-task-execution-${var.environment}"

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
  name        = "policy-ecs-secrets-read-${var.environment}"
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

# Task Role (Grants Gateway & Workers permission to call SageMaker, S3, OpenSearch)
resource "aws_iam_role" "ecs_task" {
  name = "role-ecs-task-${var.environment}"

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
  name        = "policy-ecs-task-permissions-${var.environment}"
  description = "Permissions for Gateway to invoke SageMaker, OpenSearch, and S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SageMakerInference"
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint",
          "sagemaker:InvokeEndpointWithResponseStream",
          "sagemaker:DescribeEndpoint"
        ]
        Resource = "arn:aws:sagemaker:${var.aws_region}:${data.aws_caller_identity.current.account_id}:endpoint/gini-*"
      },
      {
        Sid    = "OpenSearchAccess"
        Effect = "Allow"
        Action = [
          "es:ESHttpGet",
          "es:ESHttpPut",
          "es:ESHttpPost",
          "es:ESHttpDelete"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3DocumentAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.rag_documents.arn,
          "${aws_s3_bucket.rag_documents.arn}/*"
        ]
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
