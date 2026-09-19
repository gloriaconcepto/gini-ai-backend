#!/bin/bash
set -e

KEYCLOAK_URL=${KEYCLOAK_URL:-"http://localhost:8080"}
KEYCLOAK_ADMIN=${KEYCLOAK_ADMIN:-"admin"}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-"admin"}
CLIENT_ID=${KEYCLOAK_ADMIN_CLIENT_ID:-"gini-gateway-service"}

# Generate secure random secret if not supplied in environment
generate_fallback_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32
  elif [ -r /dev/urandom ]; then
    LC_ALL=C tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c 32
  else
    echo "2AgTtNcnIpuojPM8OKzdH4pQ5kAk9PA3"
  fi
}

CLIENT_SECRET=${KEYCLOAK_ADMIN_CLIENT_SECRET:-$(generate_fallback_secret)}

echo "Bootstrapping Keycloak client '${CLIENT_ID}' in master realm..."

docker run --rm --network host quay.io/keycloak/keycloak:24.0.0 /bin/sh -c "
  echo 'Authenticating with Keycloak admin CLI...'
  /opt/keycloak/bin/kcadm.sh config credentials --server ${KEYCLOAK_URL} --realm master --user ${KEYCLOAK_ADMIN} --password ${KEYCLOAK_ADMIN_PASSWORD}

  if /opt/keycloak/bin/kcadm.sh get clients -r master -q clientId=${CLIENT_ID} | grep -q '${CLIENT_ID}'; then
    echo 'Client ${CLIENT_ID} already exists in master realm.'
  else
    echo 'Creating ${CLIENT_ID} client...'
    /opt/keycloak/bin/kcadm.sh create clients -r master -s clientId=${CLIENT_ID} -s 'name=Gini AI Gateway Service' -s enabled=true -s clientAuthenticatorType=client-secret -s secret=${CLIENT_SECRET} -s serviceAccountsEnabled=true -s publicClient=false -s standardFlowEnabled=false -s directAccessGrantsEnabled=false

    echo 'Assigning admin role to service-account-${CLIENT_ID}...'
    /opt/keycloak/bin/kcadm.sh add-roles -r master --uusername service-account-${CLIENT_ID} --rolename admin

    echo 'Client ${CLIENT_ID} provisioned successfully!'
  fi
"
