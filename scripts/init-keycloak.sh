#!/bin/sh
set -e
KEYCLOAK_URL=${KEYCLOAK_URL:-"http://keycloak:8080"}
KEYCLOAK_ADMIN=${KEYCLOAK_ADMIN:-"admin"}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-"admin"}
KEYCLOAK_ADMIN_CLIENT_ID=${KEYCLOAK_ADMIN_CLIENT_ID:-"gini-gateway-service"}
OEM_BACKOFFICE_URL=${OEM_BACKOFFICE_URL:-"http://localhost:3002"}

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

KEYCLOAK_ADMIN_CLIENT_SECRET=${KEYCLOAK_ADMIN_CLIENT_SECRET:-$(generate_fallback_secret)}

echo "Waiting for Keycloak to be ready at ${KEYCLOAK_URL}..."
until /opt/keycloak/bin/kcadm.sh config credentials --server "${KEYCLOAK_URL}" --realm master --user "${KEYCLOAK_ADMIN}" --password "${KEYCLOAK_ADMIN_PASSWORD}"; do
  sleep 2
done

echo "Keycloak is ready. Configuring master realm admin user and service account..."

# Ensure admin user has admin realm role
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername "${KEYCLOAK_ADMIN}" --rolename admin || true

# Check/create gateway client
if /opt/keycloak/bin/kcadm.sh get clients -r master -q clientId="${KEYCLOAK_ADMIN_CLIENT_ID}" | grep -q "${KEYCLOAK_ADMIN_CLIENT_ID}"; then
  echo "Client ${KEYCLOAK_ADMIN_CLIENT_ID} already exists."
else
  echo "Creating client ${KEYCLOAK_ADMIN_CLIENT_ID} with service account..."
  /opt/keycloak/bin/kcadm.sh create clients -r master \
    -s clientId="${KEYCLOAK_ADMIN_CLIENT_ID}" \
    -s "name=Gini AI Gateway Service" \
    -s enabled=true \
    -s clientAuthenticatorType=client-secret \
    -s secret="${KEYCLOAK_ADMIN_CLIENT_SECRET}" \
    -s serviceAccountsEnabled=true \
    -s publicClient=false \
    -s standardFlowEnabled=false \
    -s directAccessGrantsEnabled=false
fi

echo "Assigning full master administrative roles to service-account-${KEYCLOAK_ADMIN_CLIENT_ID}..."
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername "service-account-${KEYCLOAK_ADMIN_CLIENT_ID}" --rolename admin || true
/opt/keycloak/bin/kcadm.sh add-roles -r master --uusername "service-account-${KEYCLOAK_ADMIN_CLIENT_ID}" --cclientid master-realm \
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

echo "${KEYCLOAK_ADMIN_CLIENT_ID} client provisioned and fully authorized!"

# Check/create/update @gini/oem-backoffice client
OEM_CLIENT_ID=$(/opt/keycloak/bin/kcadm.sh get clients -r master -q clientId="@gini/oem-backoffice" --fields id --format csv --noquotes 2>/dev/null || true)

if [ -n "$OEM_CLIENT_ID" ]; then
  echo "Client @gini/oem-backoffice exists ($OEM_CLIENT_ID). Updating configuration..."
  /opt/keycloak/bin/kcadm.sh update clients/"$OEM_CLIENT_ID" -r master \
    -s "name=Gini AI OEM Backoffice SPA" \
    -s enabled=true \
    -s publicClient=true \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s "rootUrl=${OEM_BACKOFFICE_URL}" \
    -s "baseUrl=${OEM_BACKOFFICE_URL}" \
    -s "redirectUris=[\"${OEM_BACKOFFICE_URL}/*\"]" \
    -s "webOrigins=[\"${OEM_BACKOFFICE_URL}\",\"+\"]" \
    -s "attributes={\"pkce.code.challenge.method\":\"S256\",\"post.logout.redirect.uris\":\"${OEM_BACKOFFICE_URL}/*##+\"}"
else
  echo "Creating public SPA client @gini/oem-backoffice..."
  /opt/keycloak/bin/kcadm.sh create clients -r master \
    -s 'clientId=@gini/oem-backoffice' \
    -s "name=Gini AI OEM Backoffice SPA" \
    -s enabled=true \
    -s publicClient=true \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s "rootUrl=${OEM_BACKOFFICE_URL}" \
    -s "baseUrl=${OEM_BACKOFFICE_URL}" \
    -s "redirectUris=[\"${OEM_BACKOFFICE_URL}/*\"]" \
    -s "webOrigins=[\"${OEM_BACKOFFICE_URL}\",\"+\"]" \
    -s "attributes={\"pkce.code.challenge.method\":\"S256\",\"post.logout.redirect.uris\":\"${OEM_BACKOFFICE_URL}/*##+\"}"
fi

echo "Keycloak master realm provisioning complete!"

