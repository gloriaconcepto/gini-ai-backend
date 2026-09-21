export const KEYCLOAK_CONFIG = {
  MASTER_REALM: 'master',
  MASTER_REALM_ISSUER_SUFFIX: '/realms/master',
  TENANT_REALM_PREFIX: 'tenant-',
  DEFAULT_CLIENT_ID: 'gini-frontend',
  DEFAULT_THEME: 'gini-theme',
} as const;

export const API_KEY_CONFIG = {
  PREFIX: 'gk_',
  ENTROPY_BYTES: 24,
  PREFIX_DISPLAY_LENGTH: 7,
  MS_PER_DAY: 86_400_000,
  AUTH_SCHEME: 'ApiKey ',
  HEADER_NAME: 'x-api-key',
  ISSUER: 'local-api-key',
  USER_ID_PREFIX: 'apikey-',
  DEFAULT_ROLES: ['service'] as const,
} as const;

export const JWKS_CONFIG = {
  REQUESTS_PER_MINUTE: 10,
  CACHE: true,
  RATE_LIMIT: true,
} as const;

export const ROLE_NAMES = {
  MASTER_ADMIN_ROLES: ['admin', 'realm-admin', 'manage-realm'] as const,
  GOVERNANCE_ROLES: {
    MAKER: 'maker',
    CHECKER: 'checker',
    AUDITOR: 'auditor',
    USER: 'user',
    ADMIN: 'admin',
  } as const,
} as const;

/**
 * Ensures the given tenant ID is formatted with the standard tenant realm prefix.
 */
export function getTenantRealmName(tenantId: string): string {
  if (!tenantId) return '';
  return tenantId.startsWith(KEYCLOAK_CONFIG.TENANT_REALM_PREFIX)
    ? tenantId
    : `${KEYCLOAK_CONFIG.TENANT_REALM_PREFIX}${tenantId}`;
}

/**
 * Strips the standard tenant realm prefix from a realm name to obtain the raw tenant ID.
 */
export function extractTenantIdFromRealm(realm?: string): string {
  if (!realm) return '';
  return realm.startsWith(KEYCLOAK_CONFIG.TENANT_REALM_PREFIX)
    ? realm.slice(KEYCLOAK_CONFIG.TENANT_REALM_PREFIX.length)
    : realm;
}

/**
 * Checks if the given realm name follows the tenant realm naming convention.
 */
export function isTenantRealm(realm?: string): boolean {
  return typeof realm === 'string' && realm.startsWith(KEYCLOAK_CONFIG.TENANT_REALM_PREFIX);
}

/**
 * Checks if the given JWT issuer belongs to the Keycloak Master Admin realm.
 */
export function isMasterRealmIssuer(issuer?: string): boolean {
  if (!issuer) return false;
  return (
    issuer.endsWith(KEYCLOAK_CONFIG.MASTER_REALM_ISSUER_SUFFIX) ||
    issuer.includes(KEYCLOAK_CONFIG.MASTER_REALM_ISSUER_SUFFIX) ||
    issuer.endsWith('/master')
  );
}

/**
 * Extracts the tenantId from a Keycloak issuer URL formatted as ".../realms/tenant-<tenantId>".
 */
export function extractTenantIdFromIssuer(issuer?: string): string | null {
  if (!issuer) return null;
  const match = issuer.match(/\/realms\/tenant-([a-zA-Z0-9-]+)$/);
  return match ? match[1] : null;
}
