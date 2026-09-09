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
    -s 'rootUrl=http://localhost:3002' \
    -s 'baseUrl=http://localhost:3002' \
    -s 'redirectUris=["http://localhost:3002/*"]' \
    -s 'webOrigins=["http://localhost:3002","+"]' \
    -s 'attributes={"pkce.code.challenge.method":"S256","post.logout.redirect.uris":"http://localhost:3002/*##+"}'
else
  echo "Creating public SPA client @gini/oem-backoffice..."
  /opt/keycloak/bin/kcadm.sh create clients -r master \
    -s 'clientId=@gini/oem-backoffice' \
    -s "name=Gini AI OEM Backoffice SPA" \
    -s enabled=true \
    -s publicClient=true \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s 'rootUrl=http://localhost:3002' \
    -s 'baseUrl=http://localhost:3002' \
    -s 'redirectUris=["http://localhost:3002/*"]' \
    -s 'webOrigins=["http://localhost:3002","+"]' \
    -s 'attributes={"pkce.code.challenge.method":"S256","post.logout.redirect.uris":"http://localhost:3002/*##+"}'
fi

echo "Keycloak master realm provisioning complete!"
