output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "postgres_fqdn" {
  value       = azurerm_postgresql_flexible_server.postgres.fqdn
  description = "Private FQDN for the PostgreSQL Flexible Server."
}

# output "redis_hostname" {
#   value       = azurerm_managed_redis.redis.hostname
#   description = "Azure Redis Cache endpoint for BullMQ queues and sessions."
# }

output "storage_account_name" {
  value = azurerm_storage_account.storage.name
}

output "key_vault_uri" {
  value = azurerm_key_vault.kv.vault_uri
}

output "vllm_private_ip" {
  value       = azurerm_network_interface.gpu_nic.private_ip_address
  description = "Private IP of the vLLM GPU inference runtime host."
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "redis_container_app_fqdn" {
  value       = azurerm_container_app.redis.ingress[0].fqdn
  description = "Internal FQDN for the Redis Container App (accessible by Gateway and Ingestion Workers on port 6379)."
}

output "redis_port" {
  value       = 6379
  description = "TCP port exposed by the Redis Container App."
}

output "keycloak_url" {
  value       = "https://${azurerm_container_app.keycloak.ingress[0].fqdn}"
  description = "External HTTPS URL for the Keycloak Container App."
}

output "gateway_url" {
  value       = "https://${azurerm_container_app.gateway.ingress[0].fqdn}"
  description = "External HTTPS URL for the API Gateway Container App."
}