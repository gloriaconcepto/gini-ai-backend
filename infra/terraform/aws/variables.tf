variable "aws_region" {
  description = "The AWS Region in which all resources will be provisioned."
  type        = string
  default     = "us-east-1"
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

variable "keycloak_admin_client_secret" {
  description = "Client secret for the gateway admin client in Keycloak master realm."
  type        = string
  sensitive   = true
}

variable "opensearch_instance_type" {
  description = "Instance type for the Amazon OpenSearch Managed Cluster (EBS-backed)."
  type        = string
  default     = "t3.medium.search"
}

variable "opensearch_instance_count" {
  description = "Number of data nodes in the OpenSearch cluster."
  type        = number
  default     = 2
}

variable "opensearch_ebs_volume_size" {
  description = "EBS storage volume size in GB per OpenSearch data node."
  type        = number
  default     = 20
}

variable "sagemaker_llm_instance_type" {
  description = "Instance type for the SageMaker Real-Time LLM Endpoint."
  type        = string
  default     = "ml.g5.2xlarge"
}

variable "sagemaker_llm_instance_count" {
  description = "Number of instances for the SageMaker Real-Time LLM Endpoint."
  type        = number
  default     = 1
}

variable "sagemaker_embedding_instance_type" {
  description = "Instance type for the SageMaker Embedding Endpoint."
  type        = string
  default     = "ml.g5.xlarge"
}

variable "sagemaker_embedding_instance_count" {
  description = "Number of instances for the SageMaker Embedding Endpoint."
  type        = number
  default     = 1
}

variable "enable_scale_to_zero" {
  description = "Whether to configure ECS services and SageMaker to scale to zero during idle/off-hours."
  type        = bool
  default     = false
}

variable "cors_origins" {
  description = "Comma-separated list of allowed CORS origins for the API Gateway."
  type        = string
  default     = ""
}
