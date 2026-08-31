#!/bin/bash
set -e

KEYCLOAK_URL=${KEYCLOAK_URL:-"http://localhost:8080"}
KEYCLOAK_ADMIN=${KEYCLOAK_ADMIN:-"admin"}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-"admin"}
CLIENT_ID="gini-gateway-service"
CLIENT_SECRET="2AgTtNcnIpuojPM8OKzdH4pQ5kAk9PA3"

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
