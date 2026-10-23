#!/usr/bin/env bash
# ==============================================================================
# azure-power.sh - Azure Environment Power & Cost Control Manager
# ==============================================================================
# Manages power states (stop, start, status) for Azure PostgreSQL Flexible
# Server and Container Apps to eliminate idle compute charges during off-hours.
#
# Usage:
#   ./scripts/azure-power.sh status
#   ./scripts/azure-power.sh stop [-y]
#   ./scripts/azure-power.sh start [-y]
# ==============================================================================

set -euo pipefail

# Configuration with sane defaults (can be overridden via environment variables)
PROJECT_NAME="${PROJECT_NAME:-gini-ai}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-${PROJECT_NAME}-${ENVIRONMENT}}"
AUTO_APPROVE=false

# ANSI colors
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
RESET="\033[0m"

log_info()    { echo -e "${BLUE}[INFO]${RESET} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET} $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${RESET}\n"; }

# Check dependencies
check_prerequisites() {
  if ! command -v az &>/dev/null; then
    log_error "Azure CLI ('az') is required but not installed."
    exit 1
  fi

  if ! az account show &>/dev/null; then
    log_error "Not logged into Azure CLI. Please run 'az login' first."
    exit 1
  fi
}

# Discover PostgreSQL Flexible Server
get_postgres_server() {
  local pg_server
  pg_server=$(az postgres flexible-server list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || true)
  if [[ -z "$pg_server" || "$pg_server" == "None" ]]; then
    echo ""
  else
    echo "$pg_server"
  fi
}

# Discover all Container Apps in the resource group
get_container_apps() {
  az containerapp list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || true
}

# ------------------------------------------------------------------------------
# STATUS COMMAND
# ------------------------------------------------------------------------------
show_status() {
  log_header "Azure Environment Status: ${RESOURCE_GROUP}"

  local sub_name sub_id
  sub_name=$(az account show --query "name" -o tsv)
  sub_id=$(az account show --query "id" -o tsv)
  echo -e "Subscription:   ${BOLD}${sub_name}${RESET} (${sub_id})"
  echo -e "Resource Group: ${BOLD}${RESOURCE_GROUP}${RESET}\n"

  # 1. PostgreSQL Status
  log_header "1. PostgreSQL Flexible Server"
  local pg_server
  pg_server=$(get_postgres_server)

  if [[ -n "$pg_server" ]]; then
    local pg_state pg_sku pg_fqdn
    pg_state=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$pg_server" --query "state" -o tsv 2>/dev/null || echo "Unknown")
    pg_sku=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$pg_server" --query "sku.name" -o tsv 2>/dev/null || echo "Unknown")
    pg_fqdn=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$pg_server" --query "fullyQualifiedDomainName" -o tsv 2>/dev/null || echo "Unknown")

    local state_colored="$pg_state"
    if [[ "$pg_state" == "Ready" ]]; then
      state_colored="${GREEN}Ready (Compute Active)${RESET}"
    elif [[ "$pg_state" == "Stopped" ]]; then
      state_colored="${YELLOW}Stopped (No Compute Cost)${RESET}"
    fi

    printf "  %-30s %-20s %-15s %s\n" "Server Name" "Status" "SKU" "FQDN"
    printf "  %-30s %-20b %-15s %s\n" "$pg_server" "$state_colored" "$pg_sku" "$pg_fqdn"
  else
    log_warn "No PostgreSQL Flexible Server found in ${RESOURCE_GROUP}."
  fi

  # 2. Container Apps Status
  log_header "2. Container Apps"
  local apps
  apps=$(get_container_apps)

  if [[ -n "$apps" ]]; then
    printf "  %-28s %-12s %-32s %s\n" "Application" "Status" "Latest Revision" "FQDN / Endpoint"
    printf "  %-28s %-12s %-32s %s\n" "----------------------------" "------------" "--------------------------------" "--------------------"

    while IFS= read -r app; do
      [[ -z "$app" ]] && continue
      local app_info
      app_info=$(az containerapp show --resource-group "$RESOURCE_GROUP" --name "$app" \
        --query "{running:properties.runningStatus, rev:properties.latestRevisionName, fqdn:properties.configuration.ingress.fqdn}" -o tsv 2>/dev/null || echo -e "Unknown\tUnknown\tNone")

      local run_status rev fqdn
      run_status=$(echo "$app_info" | awk '{print $1}')
      rev=$(echo "$app_info" | awk '{print $2}')
      fqdn=$(echo "$app_info" | awk '{print $3}')

      local status_display="$run_status"
      if [[ "$run_status" == "Running" ]]; then
        local active_rev_status
        active_rev_status=$(az containerapp revision show --resource-group "$RESOURCE_GROUP" --name "$rev" --app "$app" --query "properties.active" -o tsv 2>/dev/null || echo "true")
        if [[ "$active_rev_status" == "true" ]]; then
          status_display="${GREEN}Running${RESET}"
        else
          status_display="${YELLOW}Deactivated${RESET}"
        fi
      elif [[ "$run_status" == "Stopped" ]]; then
        status_display="${RED}Stopped${RESET}"
      fi

      [[ -z "$fqdn" || "$fqdn" == "None" ]] && fqdn="(Internal/No Ingress)"

      printf "  %-28s %-22b %-32s %s\n" "$app" "$status_display" "$rev" "$fqdn"
    done <<< "$apps"
  else
    log_warn "No Container Apps found in ${RESOURCE_GROUP}."
  fi

  echo ""
}

# ------------------------------------------------------------------------------
# STOP COMMAND
# ------------------------------------------------------------------------------
stop_environment() {
  log_header "Stopping Azure Environment: ${RESOURCE_GROUP}"

  if [[ "$AUTO_APPROVE" != "true" ]]; then
    echo -e "${YELLOW}This will stop all Container Apps and the PostgreSQL Flexible Server in ${BOLD}${RESOURCE_GROUP}${RESET}${YELLOW}.${RESET}"
    read -r -p "Are you sure you want to shut down dev compute resources? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[yY]([eE][sS])?$ ]]; then
      log_info "Operation aborted."
      exit 0
    fi
  fi

  # 1. Deactivate / Stop Container Apps
  log_header "Step 1: Stopping Container Apps"
  local apps
  apps=$(get_container_apps)

  if [[ -n "$apps" ]]; then
    while IFS= read -r app; do
      [[ -z "$app" ]] && continue
      log_info "Deactivating active revisions for '${app}'..."

      # Fetch active revision(s)
      local active_revs
      active_revs=$(az containerapp revision list --resource-group "$RESOURCE_GROUP" --name "$app" \
        --query "[?properties.active].name" -o tsv 2>/dev/null || true)

      if [[ -n "$active_revs" ]]; then
        while IFS= read -r rev; do
          [[ -z "$rev" ]] && continue
          az containerapp revision deactivate \
            --resource-group "$RESOURCE_GROUP" \
            --name "$rev" \
            --app "$app" \
            --only-show-errors >/dev/null 2>&1 || true
          log_success "Deactivated revision: ${rev}"
        done <<< "$active_revs"
      else
        log_info "App '${app}' has no active revisions."
      fi
    done <<< "$apps"
  fi

  # 2. Stop PostgreSQL Flexible Server
  log_header "Step 2: Stopping PostgreSQL Flexible Server"
  local pg_server
  pg_server=$(get_postgres_server)

  if [[ -n "$pg_server" ]]; then
    local current_state
    current_state=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$pg_server" --query "state" -o tsv 2>/dev/null || echo "Unknown")

    if [[ "$current_state" == "Stopped" ]]; then
      log_info "PostgreSQL server '${pg_server}' is already stopped."
    elif [[ "$current_state" == "Stopping" ]]; then
      log_info "PostgreSQL server '${pg_server}' is already stopping."
    else
      log_info "Stopping PostgreSQL server '${pg_server}' (stopping compute charges)..."
      az postgres flexible-server stop \
        --resource-group "$RESOURCE_GROUP" \
        --name "$pg_server" \
        --no-wait \
        --only-show-errors
      log_success "Initiated shutdown for PostgreSQL server: ${pg_server}"
    fi
  fi

  echo ""
  log_success "Dev environment compute successfully halted! Zero compute billing is now active."
}

# ------------------------------------------------------------------------------
# START COMMAND
# ------------------------------------------------------------------------------
start_environment() {
  log_header "Starting Azure Environment: ${RESOURCE_GROUP}"

  if [[ "$AUTO_APPROVE" != "true" ]]; then
    echo -e "${GREEN}This will start PostgreSQL Flexible Server and all Container Apps in ${BOLD}${RESOURCE_GROUP}${RESET}${GREEN}.${RESET}"
    read -r -p "Proceed with startup? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[yY]([eE][sS])?$ ]]; then
      log_info "Operation aborted."
      exit 0
    fi
  fi

  # 1. Start PostgreSQL Flexible Server first (prerequisite for backend services)
  log_header "Step 1: Starting PostgreSQL Flexible Server"
  local pg_server
  pg_server=$(get_postgres_server)

  if [[ -n "$pg_server" ]]; then
    local current_state
    current_state=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$pg_server" --query "state" -o tsv 2>/dev/null || echo "Unknown")

    if [[ "$current_state" == "Ready" ]]; then
      log_info "PostgreSQL server '${pg_server}' is already Ready."
    else
      log_info "Starting PostgreSQL server '${pg_server}'... (this may take ~1-2 minutes)"
      az postgres flexible-server start \
        --resource-group "$RESOURCE_GROUP" \
        --name "$pg_server" \
        --only-show-errors
      log_success "PostgreSQL server '${pg_server}' is now Ready!"
    fi
  fi

  # 2. Start Container Apps in Dependency Order
  log_header "Step 2: Starting Container Apps"

  # Core backing services first, then Gateway, then Frontends
  local startup_order=(
    "ca-redis-${ENVIRONMENT}"
    "ca-keycloak-${ENVIRONMENT}"
    "ca-gateway-${ENVIRONMENT}"
    "ca-enterprise-portal-${ENVIRONMENT}"
    "ca-oem-backoffice-${ENVIRONMENT}"
  )

  for app in "${startup_order[@]}"; do
    if az containerapp show --resource-group "$RESOURCE_GROUP" --name "$app" &>/dev/null; then
      log_info "Activating '${app}'..."

      # Fetch latest revision
      local latest_rev
      latest_rev=$(az containerapp show --resource-group "$RESOURCE_GROUP" --name "$app" --query "properties.latestRevisionName" -o tsv 2>/dev/null || true)

      if [[ -n "$latest_rev" ]]; then
        az containerapp revision activate \
          --resource-group "$RESOURCE_GROUP" \
          --name "$latest_rev" \
          --app "$app" \
          --only-show-errors >/dev/null 2>&1 || true
        log_success "Activated revision '${latest_rev}' for '${app}'."
      fi
    fi
  done

  echo ""
  log_success "Environment startup complete! Displaying updated statuses:"
  show_status
}

# ------------------------------------------------------------------------------
# USAGE & CLI ROUTER
# ------------------------------------------------------------------------------
usage() {
  cat << EOF
Azure Environment Power & Cost Control Tool

Usage:
  $(basename "$0") <command> [options]

Commands:
  status       Inspect current power state of PostgreSQL Flexible Server and Container Apps
  stop         Deactivate all Container Apps and stop PostgreSQL Flexible Server (save costs)
  start        Start PostgreSQL Flexible Server and reactivate all Container Apps
  help         Display this help message

Options:
  -y, --yes    Skip confirmation prompts (for automated workflows / CI/CD)
  -g, --group  Override default Azure Resource Group (default: ${RESOURCE_GROUP})
  -e, --env    Override deployment environment (default: ${ENVIRONMENT})

Examples:
  ./scripts/azure-power.sh status
  ./scripts/azure-power.sh stop -y
  ./scripts/azure-power.sh start -y
  AZURE_RESOURCE_GROUP=rg-gini-ai-staging ./scripts/azure-power.sh status
EOF
}

# Parse flags
ACTION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    status|stop|start|help)
      ACTION="$1"
      shift
      ;;
    -y|--yes)
      AUTO_APPROVE=true
      shift
      ;;
    -g|--group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    *)
      log_error "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

check_prerequisites

case "${ACTION:-help}" in
  status)
    show_status
    ;;
  stop)
    stop_environment
    ;;
  start)
    start_environment
    ;;
  help)
    usage
    ;;
esac
