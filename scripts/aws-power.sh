#!/usr/bin/env bash
# ==============================================================================
# aws-power.sh - AWS Environment Power & Cost Control Manager
# ==============================================================================
# Manages power states (stop, start, status) for Amazon RDS PostgreSQL, Amazon
# ECS Fargate services, Amazon OpenSearch, and AWS SageMaker AI endpoints to
# eliminate idle compute charges during off-hours.
#
# Usage:
#   ./scripts/aws-power.sh status
#   ./scripts/aws-power.sh stop [-y]
#   ./scripts/aws-power.sh start [-y]
# ==============================================================================

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-gini-ai}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
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
  if ! command -v aws &>/dev/null; then
    log_error "AWS CLI ('aws') is required but not installed."
    exit 1
  fi

  if ! aws sts get-caller-identity --region "$AWS_REGION" &>/dev/null; then
    log_error "Not authenticated to AWS CLI. Please run 'aws configure' or export AWS credentials."
    exit 1
  fi
}

get_rds_instance() {
  aws rds describe-db-instances \
    --region "$AWS_REGION" \
    --query "DBInstances[?starts_with(DBInstanceIdentifier, 'psql-${PROJECT_NAME}-${ENVIRONMENT}')].DBInstanceIdentifier | [0]" \
    --output text 2>/dev/null || echo "None"
}

get_ecs_cluster() {
  echo "ecs-${PROJECT_NAME}-${ENVIRONMENT}"
}

# ------------------------------------------------------------------------------
# STATUS COMMAND
# ------------------------------------------------------------------------------
show_status() {
  log_header "AWS Environment Status: ${PROJECT_NAME}-${ENVIRONMENT} (${AWS_REGION})"

  local account_id user_arn
  account_id=$(aws sts get-caller-identity --query "Account" --output text)
  user_arn=$(aws sts get-caller-identity --query "Arn" --output text)
  echo -e "Account ID: ${BOLD}${account_id}${RESET}"
  echo -e "Caller:     ${BOLD}${user_arn}${RESET}"
  echo -e "Region:     ${BOLD}${AWS_REGION}${RESET}\n"

  # 1. Amazon RDS PostgreSQL
  log_header "1. Amazon RDS PostgreSQL 16"
  local rds_id
  rds_id=$(get_rds_instance)

  if [[ -n "$rds_id" && "$rds_id" != "None" ]]; then
    local rds_status rds_class rds_endpoint
    rds_status=$(aws rds describe-db-instances --db-instance-identifier "$rds_id" --region "$AWS_REGION" --query "DBInstances[0].DBInstanceStatus" --output text)
    rds_class=$(aws rds describe-db-instances --db-instance-identifier "$rds_id" --region "$AWS_REGION" --query "DBInstances[0].DBInstanceClass" --output text)
    rds_endpoint=$(aws rds describe-db-instances --db-instance-identifier "$rds_id" --region "$AWS_REGION" --query "DBInstances[0].Endpoint.Address" --output text)

    local status_colored="$rds_status"
    if [[ "$rds_status" == "available" ]]; then
      status_colored="${GREEN}Available (Active Compute)${RESET}"
    elif [[ "$rds_status" == "stopped" ]]; then
      status_colored="${YELLOW}Stopped (No Compute Charges)${RESET}"
    fi

    printf "  %-32s %-25s %-15s %s\n" "Instance Identifier" "Status" "Class" "Endpoint"
    printf "  %-32s %-25b %-15s %s\n" "$rds_id" "$status_colored" "$rds_class" "$rds_endpoint"
  else
    log_warn "No RDS instance found matching 'psql-${PROJECT_NAME}-${ENVIRONMENT}*'."
  fi

  # 2. Amazon ECS Fargate Services
  log_header "2. Amazon ECS Fargate Services"
  local cluster_name
  cluster_name=$(get_ecs_cluster)
  local services
  services=$(aws ecs list-services --cluster "$cluster_name" --region "$AWS_REGION" --query "serviceArns[]" --output text 2>/dev/null || echo "")

  if [[ -n "$services" ]]; then
    printf "  %-30s %-10s %-10s %-15s\n" "Service Name" "Desired" "Running" "Status"
    printf "  %-30s %-10s %-10s %-15s\n" "------------------------------" "-------" "-------" "---------------"

    for svc_arn in $services; do
      local svc_name
      svc_name=$(basename "$svc_arn")
      local svc_info
      svc_info=$(aws ecs describe-services --cluster "$cluster_name" --services "$svc_name" --region "$AWS_REGION" \
        --query "services[0].{desired:desiredCount, running:runningCount, status:status}" --output text)
      local desired running status
      desired=$(echo "$svc_info" | awk '{print $1}')
      running=$(echo "$svc_info" | awk '{print $2}')
      status=$(echo "$svc_info" | awk '{print $3}')

      local run_colored="${running}"
      if [[ "$running" -gt 0 ]]; then
        run_colored="${GREEN}${running}${RESET}"
      else
        run_colored="${YELLOW}${running}${RESET}"
      fi

      printf "  %-30s %-10s %-10b %-15s\n" "$svc_name" "$desired" "$run_colored" "$status"
    done
  else
    log_warn "No active ECS services found in cluster '${cluster_name}'."
  fi

  # 3. Amazon OpenSearch Domain
  log_header "3. Amazon OpenSearch Service"
  local domain_name="${PROJECT_NAME}-rag-${ENVIRONMENT}"
  local os_status
  os_status=$(aws opensearch describe-domain --domain-name "$domain_name" --region "$AWS_REGION" \
    --query "DomainStatus.{created:Created, processing:Processing, endpoint:Endpoint}" --output text 2>/dev/null || echo "Not Found")

  if [[ "$os_status" != "Not Found" ]]; then
    echo -e "  Domain:   ${BOLD}${domain_name}${RESET}"
    echo -e "  Endpoint: https://$(echo "$os_status" | awk '{print $3}')"
  else
    log_warn "OpenSearch domain '${domain_name}' not provisioned yet."
  fi

  # 4. AWS SageMaker Endpoints
  log_header "4. AWS SageMaker AI Endpoints"
  local sm_endpoints
  sm_endpoints=$(aws sagemaker list-endpoints --region "$AWS_REGION" \
    --name-contains "gini-" --query "Endpoints[].{name:EndpointName, status:EndpointStatus}" --output text 2>/dev/null || echo "")

  if [[ -n "$sm_endpoints" ]]; then
    printf "  %-35s %-20s\n" "Endpoint Name" "Status"
    printf "  %-35s %-20s\n" "-----------------------------------" "--------------------"
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      local ep_name ep_stat
      ep_name=$(echo "$line" | awk '{print $1}')
      ep_stat=$(echo "$line" | awk '{print $2}')
      local ep_colored="$ep_stat"
      if [[ "$ep_stat" == "InService" ]]; then
        ep_colored="${GREEN}InService${RESET}"
      fi
      printf "  %-35s %-20b\n" "$ep_name" "$ep_colored"
    done <<< "$sm_endpoints"
  else
    log_info "No active SageMaker endpoints detected with prefix 'gini-'."
  fi
}

# ------------------------------------------------------------------------------
# STOP COMMAND
# ------------------------------------------------------------------------------
stop_environment() {
  log_header "Stopping AWS Environment: ${PROJECT_NAME}-${ENVIRONMENT}"

  if [[ "$AUTO_APPROVE" != "true" ]]; then
    read -rp "Are you sure you want to STOP compute for ${PROJECT_NAME}-${ENVIRONMENT}? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      log_info "Stop command aborted by user."
      exit 0
    fi
  fi

  # 1. Scale ECS Fargate services to 0
  local cluster_name
  cluster_name=$(get_ecs_cluster)
  local services
  services=$(aws ecs list-services --cluster "$cluster_name" --region "$AWS_REGION" --query "serviceArns[]" --output text 2>/dev/null || echo "")

  if [[ -n "$services" ]]; then
    for svc_arn in $services; do
      local svc_name
      svc_name=$(basename "$svc_arn")
      log_info "Scaling ECS service '${svc_name}' desired count to 0..."
      aws ecs update-service --cluster "$cluster_name" --service "$svc_name" --desired-count 0 --region "$AWS_REGION" >/dev/null
    done
    log_success "All ECS services scaled to 0 replicas."
  fi

  # 2. Stop RDS PostgreSQL instance
  local rds_id
  rds_id=$(get_rds_instance)
  if [[ -n "$rds_id" && "$rds_id" != "None" ]]; then
    local rds_status
    rds_status=$(aws rds describe-db-instances --db-instance-identifier "$rds_id" --region "$AWS_REGION" --query "DBInstances[0].DBInstanceStatus" --output text)
    if [[ "$rds_status" == "available" ]]; then
      log_info "Stopping RDS instance '${rds_id}'..."
      aws rds stop-db-instance --db-instance-identifier "$rds_id" --region "$AWS_REGION" >/dev/null
      log_success "RDS stop command initiated (takes ~2 minutes to fully stop)."
    else
      log_info "RDS instance '${rds_id}' is currently in state '${rds_status}' (not available to stop)."
    fi
  fi

  log_success "Environment '${PROJECT_NAME}-${ENVIRONMENT}' compute shutdown complete. Off-hours charges paused."
}

# ------------------------------------------------------------------------------
# START COMMAND
# ------------------------------------------------------------------------------
start_environment() {
  log_header "Starting AWS Environment: ${PROJECT_NAME}-${ENVIRONMENT}"

  # 1. Start RDS instance
  local rds_id
  rds_id=$(get_rds_instance)
  if [[ -n "$rds_id" && "$rds_id" != "None" ]]; then
    local rds_status
    rds_status=$(aws rds describe-db-instances --db-instance-identifier "$rds_id" --region "$AWS_REGION" --query "DBInstances[0].DBInstanceStatus" --output text)
    if [[ "$rds_status" == "stopped" ]]; then
      log_info "Starting RDS instance '${rds_id}'..."
      aws rds start-db-instance --db-instance-identifier "$rds_id" --region "$AWS_REGION" >/dev/null
      log_success "RDS start command initiated. Please allow 3-5 minutes for PostgreSQL to become healthy."
    else
      log_info "RDS instance '${rds_id}' is already in state '${rds_status}'."
    fi
  fi

  # 2. Scale ECS services back to 1
  local cluster_name
  cluster_name=$(get_ecs_cluster)
  local services
  services=$(aws ecs list-services --cluster "$cluster_name" --region "$AWS_REGION" --query "serviceArns[]" --output text 2>/dev/null || echo "")

  if [[ -n "$services" ]]; then
    for svc_arn in $services; do
      local svc_name
      svc_name=$(basename "$svc_arn")
      log_info "Scaling ECS service '${svc_name}' desired count to 1..."
      aws ecs update-service --cluster "$cluster_name" --service "$svc_name" --desired-count 1 --region "$AWS_REGION" >/dev/null
    done
    log_success "All ECS services scaled to 1 replica."
  fi

  log_success "Environment '${PROJECT_NAME}-${ENVIRONMENT}' startup complete."
}

# ------------------------------------------------------------------------------
# ENTRYPOINT
# ------------------------------------------------------------------------------
check_prerequisites

COMMAND="${1:-status}"
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      AUTO_APPROVE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

case "$COMMAND" in
  status)
    show_status
    ;;
  stop)
    stop_environment
    ;;
  start)
    start_environment
    ;;
  *)
    echo "Usage: $0 {status|stop|start} [-y]"
    exit 1
    ;;
esac
