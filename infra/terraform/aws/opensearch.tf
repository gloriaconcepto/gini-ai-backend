# =============================================================================
# Amazon OpenSearch Service (Managed Cluster with EBS Storage)
# =============================================================================
# Serves as the dedicated vector store and knowledge base for the SageMaker RAG
# pipeline. Supports k-NN vector similarity search, BM25 full-text keyword
# search, and native hybrid search.
# =============================================================================

resource "aws_security_group" "opensearch" {
  name        = "${var.project_name}-opensearch-sg-${var.environment}"
  description = "Controls HTTPS access to OpenSearch domain from ECS tasks and SageMaker"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTPS from ECS tasks"
    from_port       = 443
    to_port         = 443
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
    Name = "${var.project_name}-opensearch-sg-${var.environment}"
  }
}

resource "aws_opensearch_domain" "rag_vector_store" {
  domain_name    = "${var.project_name}-rag-${var.environment}"
  engine_version = "OpenSearch_2.11"

  cluster_config {
    instance_type          = var.opensearch_instance_type
    instance_count         = var.opensearch_instance_count
    zone_awareness_enabled = true

    zone_awareness_config {
      availability_zone_count = 2
    }
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = var.opensearch_ebs_volume_size
  }

  vpc_options {
    subnet_ids         = aws_subnet.private_search[*].id
    security_group_ids = [aws_security_group.opensearch.id]
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  advanced_options = {
    "rest.action.multi.allow_explicit_index" = "true"
  }

  tags = {
    Name        = "${var.project_name}-rag-${var.environment}"
    Component   = "VectorStore"
    Engine      = "OpenSearch"
  }
}

# Domain Access Policy granting IAM permissions to ECS tasks and SageMaker pipeline roles
resource "aws_opensearch_domain_policy" "rag_vector_store" {
  domain_name = aws_opensearch_domain.rag_vector_store.domain_name

  access_policies = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.ecs_task.arn,
            aws_iam_role.sagemaker_execution.arn
          ]
        }
        Action   = "es:*"
        Resource = "${aws_opensearch_domain.rag_vector_store.arn}/*"
      }
    ]
  })
}

# Parameter store token for application auto-discovery
resource "aws_ssm_parameter" "opensearch_endpoint" {
  name  = "/${var.project_name}/${var.environment}/opensearch/endpoint"
  type  = "String"
  value = "https://${aws_opensearch_domain.rag_vector_store.endpoint}"
}
