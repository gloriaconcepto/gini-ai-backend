terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
}

provider "azurerm" {
  #   subscription_id = "d6d62d88-dd8e-4d3e-b68f-14d2be8a33d2"
  #   tenant_id       = "ee8b6be7-3ccd-4c59-b957-60baaa805c5f"

  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-${var.project_name}-${var.environment}"
  location = var.location
}

# -----------------------------------------------------------------------------
# 1. VIRTUAL NETWORK & SUBNETS
# -----------------------------------------------------------------------------
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-${var.project_name}-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "db_subnet" {
  name                 = "snet-postgres"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
  delegation {
    name = "fs-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "aca_subnet" {
  name                 = "snet-aca-apps"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.2.0/23"]
  delegation {
    name = "aca-delegation"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# GPU PROVISION: Retained for future vLLM deployment
resource "azurerm_subnet" "gpu_subnet" {
  name                 = "snet-vllm-gpu"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.4.0/24"]
}

resource "azurerm_private_dns_zone" "pg_dns" {
  name                = "${var.project_name}-${var.environment}.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "pg_dns_link" {
  name                  = "pg-dns-vnet-link"
  private_dns_zone_name = azurerm_private_dns_zone.pg_dns.name
  virtual_network_id    = azurerm_virtual_network.vnet.id
  resource_group_name   = azurerm_resource_group.rg.name
}

# -----------------------------------------------------------------------------
# 2. DATABASE (PostgreSQL)
# -----------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "postgres" {
  name                          = "psql-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = azurerm_resource_group.rg.location
  version                       = "16"
  delegated_subnet_id           = azurerm_subnet.db_subnet.id
  private_dns_zone_id           = azurerm_private_dns_zone.pg_dns.id
  public_network_access_enabled = false
  administrator_login           = var.db_admin_username
  administrator_password        = var.db_admin_password
  sku_name                      = "B_Standard_B2s"

  depends_on = [azurerm_private_dns_zone_virtual_network_link.pg_dns_link]
}

resource "azurerm_postgresql_flexible_server_configuration" "pg_extensions" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  value     = "VECTOR,UUID-OSSP,PG_TRGM"
}

resource "azurerm_postgresql_flexible_server_database" "app_db" {
  name       = "ginidb"
  server_id  = azurerm_postgresql_flexible_server.postgres.id
  collation  = "en_US.utf8"
  charset    = "utf8"
  depends_on = [azurerm_postgresql_flexible_server_configuration.pg_extensions]
}

resource "azurerm_postgresql_flexible_server_database" "keycloak_db" {
  name      = "keycloak"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# -----------------------------------------------------------------------------
# 3. CONTAINER INFRASTRUCTURE
# -----------------------------------------------------------------------------
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-${var.project_name}-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "aca_env" {
  name                       = "cae-${var.project_name}-${var.environment}"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  infrastructure_subnet_id   = azurerm_subnet.aca_subnet.id

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_container_registry" "acr" {
  name                = lower(replace("cr${var.project_name}${var.environment}${random_string.suffix.result}", "-", ""))
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

# -----------------------------------------------------------------------------
# 4. MICROSERVICES (Redis, Keycloak, Gateway)
# -----------------------------------------------------------------------------
resource "azurerm_container_app" "redis" {
  name                         = "ca-redis-${var.environment}"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  ingress {
    external_enabled = false
    target_port      = 6379
    transport        = "tcp"
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1
    container {
      name   = "redis"
      image  = "redis:7-alpine"
      cpu    = 0.5
      memory = "1Gi"
      args   = ["redis-server", "--maxmemory", "800mb", "--maxmemory-policy", "volatile-lru"]
    }
  }
}

resource "azurerm_container_app" "keycloak" {
  name                         = "ca-keycloak-${var.environment}"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  ingress {
    external_enabled = true
    target_port      = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 1
    max_replicas = 2
    container {
      name   = "keycloak"
      image  = "quay.io/keycloak/keycloak:24.0.0"
      cpu    = 1.0
      memory = "2Gi"
      args   = ["start-dev"]

      env {
        name  = "KC_DB"
        value = "postgres"
      }
      env {
        name  = "KC_DB_URL"
        value = "jdbc:postgresql://${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/keycloak"
      }
      env {
        name  = "KC_DB_USERNAME"
        value = var.db_admin_username
      }
      env {
        name  = "KC_DB_PASSWORD"
        value = var.db_admin_password
      }
      env {
        name  = "KEYCLOAK_ADMIN"
        value = "admin"
      }
      env {
        name  = "KEYCLOAK_ADMIN_PASSWORD"
        value = "admin"
      }
      env {
        name  = "KC_PROXY"
        value = "edge"
      }
    }
  }
}

resource "azurerm_container_app" "gateway" {
  name                         = "ca-gateway-${var.environment}"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  ingress {
    external_enabled = true
    target_port      = 3000
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.gateway_identity.id]
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }

  secret {
    name                = "database-url"
    key_vault_secret_id = azurerm_key_vault_secret.database_url.id
    identity            = azurerm_user_assigned_identity.gateway_identity.id
  }

  secret {
    name                = "keycloak-admin-client-secret"
    key_vault_secret_id = azurerm_key_vault_secret.keycloak_admin_client_secret.id
    identity            = azurerm_user_assigned_identity.gateway_identity.id
  }

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  template {
    min_replicas = 1
    max_replicas = 5
    container {
      name = "api-gateway"
      # Placeholder image used to bootstrap the infrastructure.
      # A CI/CD pipeline should build, push the real image, and update this container app.
      image  = "node:20-alpine"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name  = "KEYCLOAK_ADMIN_CLIENT_ID"
        value = var.keycloak_admin_client_id
      }
      env {
        name        = "KEYCLOAK_ADMIN_CLIENT_SECRET"
        secret_name = "keycloak-admin-client-secret"
      }
      env {
        name  = "REDIS_HOST"
        value = azurerm_container_app.redis.ingress[0].fqdn
      }
      env {
        name  = "KEYCLOAK_URL"
        value = "https://${azurerm_container_app.keycloak.ingress[0].fqdn}/realms/gini-tenant"
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image
    ]
  }
}

# -----------------------------------------------------------------------------
# 5. FRONTEND CONTAINER APPS
# -----------------------------------------------------------------------------
locals {
  frontend_apps = {
    "manager-app" = {
      target_port  = 80
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 3
    }
    "oem-backoffice" = {
      target_port  = 80
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 3
    }
    "tenant-admin" = {
      target_port  = 80
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 3
    }
    "user-app" = {
      target_port  = 80
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 3
    }
  }
}

resource "azurerm_container_app" "frontend" {
  for_each                     = local.frontend_apps
  name                         = "ca-${each.key}-${var.environment}"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.aca_env.id
  revision_mode                = "Single"

  ingress {
    external_enabled = true
    target_port      = each.value.target_port
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  identity {
    type = "SystemAssigned"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.acr.admin_password
  }

  registry {
    server               = azurerm_container_registry.acr.login_server
    username             = azurerm_container_registry.acr.admin_username
    password_secret_name = "acr-password"
  }

  template {
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas
    container {
      name   = each.key
      image  = "nginx:alpine"
      cpu    = each.value.cpu
      memory = each.value.memory

      env {
        name  = "GATEWAY_URL"
        value = "https://${azurerm_container_app.gateway.ingress[0].fqdn}"
      }
      env {
        name  = "KEYCLOAK_URL"
        value = "https://${azurerm_container_app.keycloak.ingress[0].fqdn}"
      }
      env {
        name  = "APP_NAME"
        value = each.key
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image
    ]
  }
}

# -----------------------------------------------------------------------------
# 6. STORAGE & SECURITY & MISC
# -----------------------------------------------------------------------------
data "azurerm_client_config" "current" {}

resource "azurerm_storage_account" "storage" {
  name                     = "st${replace(var.project_name, "-", "")}${var.environment}${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_key_vault" "kv" {
  name                        = "kv-${var.project_name}-${var.environment}-${random_string.suffix.result}"
  location                    = azurerm_resource_group.rg.location
  resource_group_name         = azurerm_resource_group.rg.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  rbac_authorization_enabled  = true

  sku_name = "standard"
}

resource "azurerm_user_assigned_identity" "gateway_identity" {
  name                = "id-gateway-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_role_assignment" "terraform_kv_admin" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "gateway_kv_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.gateway_identity.principal_id
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = "postgresql://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/ginidb"
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [azurerm_role_assignment.terraform_kv_admin]
}

resource "azurerm_key_vault_secret" "keycloak_admin_client_secret" {
  name         = "keycloak-admin-client-secret"
  value        = var.keycloak_admin_client_secret
  key_vault_id = azurerm_key_vault.kv.id
  depends_on   = [azurerm_role_assignment.terraform_kv_admin]
}

resource "azurerm_network_interface" "gpu_nic" {
  name                = "nic-vllm-gpu-${var.environment}"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.gpu_subnet.id
    private_ip_address_allocation = "Dynamic"
  }
}