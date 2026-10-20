variable "aws_region" {
  description = "The AWS Region in which all resources will be provisioned."
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Project name prefix for resource naming conventions."
  type        = string
  default     = "gini-ai"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_admin_username" {
  description = "Master username for RDS PostgreSQL."
  type        = string
  default     = "pgadmin"
}

variable "db_admin_password" {
  description = "Master password for RDS PostgreSQL."
  type        = string
  sensitive   = true
}

variable "rds_instance_class" {
  description = "Instance class for the Amazon RDS PostgreSQL instance."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version for Amazon RDS."
  type        = string
  default     = "16.15"
}

variable "rds_max_allocated_storage" {
  description = "Maximum storage threshold in GiB to which RDS can automatically scale."
  type        = number
  default     = 50
}

variable "keycloak_admin_username" {
  description = "Master realm admin username for Keycloak."
  type        = string
  default     = "admin"
}

variable "keycloak_admin_password" {
  description = "Master realm admin password for Keycloak."
  type        = string
  sensitive   = true
}

variable "keycloak_admin_client_id" {
  description = "Keycloak confidential client ID for Gateway administrative access."
  type        = string
  default     = "gini-gateway-service"
}

variable "keycloak_admin_client_secret" {
  description = "Client secret for the gateway admin client in Keycloak master realm."
  type        = string
  sensitive   = true
}

variable "s3_document_bucket_name" {
  description = "Name of the external S3 bucket managed by the standalone RAG pipeline for tenant documents."
  type        = string
  default     = "gini-rag-documents"
}

variable "enable_scale_to_zero" {
  description = "Whether to configure ECS services to scale to zero during idle/off-hours."
  type        = bool
  default     = true
}

variable "cors_origins" {
  description = "Comma-separated list of allowed CORS origins for the API Gateway."
  type        = string
  default     = ""
}

variable "frontend_price_class" {
  description = "CloudFront distribution price class for the frontend SPA (PriceClass_100, PriceClass_200, PriceClass_All)."
  type        = string
  default     = "PriceClass_100"
}

variable "enable_frontend" {
  description = "Whether to provision CloudFront CDN distributions and S3 hosting for the frontend SPAs."
  type        = bool
  default     = true
}

variable "github_repo" {
  description = "GitHub repository for GitHub Actions OIDC federation (format: owner/repo)."
  type        = string
  default     = "gloriaconcepto/gini-ai-backend"
}
