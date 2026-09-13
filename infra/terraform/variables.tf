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

variable "keycloak_admin_client_id" {
  type        = string
  default     = "gini-gateway-service"
  description = "Keycloak confidential client ID for Gateway administrative access."
}

variable "keycloak_admin_client_secret" {
  type        = string
  sensitive   = true
  description = "Keycloak confidential client secret for Gateway administrative access."
}

variable "keycloak_admin_username" {
  type        = string
  default     = "admin"
  description = "Keycloak initial master administrator username."
}

variable "keycloak_admin_password" {
  type        = string
  sensitive   = true
  description = "Keycloak initial master administrator password."
}

variable "enable_scale_to_zero" {
  type        = bool
  default     = true
  description = "Whether to allow container apps to scale down to 0 replicas when idle (cost-saving for dev/staging)."
}