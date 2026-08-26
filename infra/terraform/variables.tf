variable "project_name" {
  type        = string
  default     = "gini-ai"
  description = "Base name prefix for all Policy AI resources."
}

variable "environment" {
  type        = string
  default     = "dev"
  description = "Target deployment environment."
}

variable "location" {
  type        = string
  default     = "westus"
  description = "Azure region for provisioning."
}

variable "db_admin_username" {
  type        = string
  default     = "pgadmin"
  description = "PostgreSQL Flexible Server administrator username."
}

variable "db_admin_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL Flexible Server administrator password."
}