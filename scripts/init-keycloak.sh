#!/bin/sh
set -e

echo "Waiting for Keycloak to be ready..."
until /opt/keycloak/bin/kcadm.sh config credentials --server http://keycloak:8080 --realm master --user admin --password admin; do
  sleep 2
done

echo "Keycloak is ready. Configuring master realm admin user and service account..."

# Ensure admin user has admin realm role
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername admin --rolename admin || true

# Check/create gini-gateway-service client
if /opt/keycloak/bin/kcadm.sh get clients -r master -q clientId=gini-gateway-service | grep -q 'gini-gateway-service'; then
  echo "Client gini-gateway-service already exists."
else
  echo "Creating client gini-gateway-service with service account..."
  /opt/keycloak/bin/kcadm.sh create clients -r master \
    -s clientId=gini-gateway-service \
    -s "name=Gini AI Gateway Service" \
    -s enabled=true \
    -s clientAuthenticatorType=client-secret \
    -s secret=2AgTtNcnIpuojPM8OKzdH4pQ5kAk9PA3 \
    -s serviceAccountsEnabled=true \
    -s publicClient=false \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false
fi

echo "Assigning full master administrative roles to service-account-gini-gateway-service..."
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername service-account-gini-gateway-service --rolename admin || true
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername service-account-gini-gateway-service --cclientid master-realm \
  --rolename manage-realm \
  --rolename manage-users \
  --rolename manage-clients \
  --rolename create-client \
  --rolename view-realm \
  --rolename view-users \
  --rolename view-clients \
  --rolename manage-identity-providers \
  --rolename view-identity-providers \
  --rolename query-realms \
  --rolename query-users \
  --rolename query-groups \
  --rolename query-clients || true

echo "gini-gateway-service client provisioned and fully authorized!"
