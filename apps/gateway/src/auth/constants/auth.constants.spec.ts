import {
  KEYCLOAK_CONFIG,
  API_KEY_CONFIG,
  JWKS_CONFIG,
  ROLE_NAMES,
  getTenantRealmName,
  extractTenantIdFromRealm,
  isTenantRealm,
  isMasterRealmIssuer,
  extractTenantIdFromIssuer,
} from './auth.constants';

describe('Auth Constants & Helpers', () => {
  describe('getTenantRealmName', () => {
    it('should prefix tenantId with tenant- if not already prefixed', () => {
      expect(getTenantRealmName('12345')).toBe('tenant-12345');
    });

    it('should not double-prefix if already starts with tenant-', () => {
      expect(getTenantRealmName('tenant-12345')).toBe('tenant-12345');
    });

    it('should return empty string if empty string provided', () => {
      expect(getTenantRealmName('')).toBe('');
    });
  });

  describe('extractTenantIdFromRealm', () => {
    it('should strip tenant- prefix from realm name', () => {
      expect(extractTenantIdFromRealm('tenant-acme-corp')).toBe('acme-corp');
    });

    it('should return raw realm if it does not have tenant- prefix', () => {
      expect(extractTenantIdFromRealm('master')).toBe('master');
    });

    it('should return empty string if undefined or empty', () => {
      expect(extractTenantIdFromRealm(undefined)).toBe('');
      expect(extractTenantIdFromRealm('')).toBe('');
    });
  });

  describe('isTenantRealm', () => {
    it('should return true for tenant realms', () => {
      expect(isTenantRealm('tenant-abc')).toBe(true);
    });

    it('should return false for non-tenant realms', () => {
      expect(isTenantRealm('master')).toBe(false);
      expect(isTenantRealm(undefined)).toBe(false);
      expect(isTenantRealm('')).toBe(false);
    });
  });

  describe('isMasterRealmIssuer', () => {
    it('should return true for master realm issuers', () => {
      expect(isMasterRealmIssuer('http://localhost:8080/realms/master')).toBe(true);
      expect(isMasterRealmIssuer('https://keycloak.example.com/realms/master')).toBe(true);
      expect(isMasterRealmIssuer('http://localhost:8080/master')).toBe(true);
    });

    it('should return false for tenant realm issuers or undefined', () => {
      expect(isMasterRealmIssuer('http://localhost:8080/realms/tenant-123')).toBe(false);
      expect(isMasterRealmIssuer(undefined)).toBe(false);
      expect(isMasterRealmIssuer('')).toBe(false);
    });
  });

  describe('extractTenantIdFromIssuer', () => {
    it('should extract tenantId from issuer URL', () => {
      expect(
        extractTenantIdFromIssuer('http://localhost:8080/realms/tenant-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'),
      ).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    });

    it('should return null for invalid or master issuer URLs', () => {
      expect(extractTenantIdFromIssuer('http://localhost:8080/realms/master')).toBeNull();
      expect(extractTenantIdFromIssuer(undefined)).toBeNull();
      expect(extractTenantIdFromIssuer('')).toBeNull();
    });
  });

  describe('Config Objects', () => {
    it('should export expected constant configurations', () => {
      expect(KEYCLOAK_CONFIG.DEFAULT_CLIENT_ID).toBe('gini-frontend');
      expect(KEYCLOAK_CONFIG.DEFAULT_THEME).toBe('gini-theme');
      expect(KEYCLOAK_CONFIG.MASTER_REALM).toBe('master');
      expect(API_KEY_CONFIG.PREFIX).toBe('gk_');
      expect(API_KEY_CONFIG.ENTROPY_BYTES).toBe(24);
      expect(JWKS_CONFIG.REQUESTS_PER_MINUTE).toBe(10);
      expect(ROLE_NAMES.MASTER_ADMIN_ROLES).toContain('admin');
      expect(ROLE_NAMES.GOVERNANCE_ROLES.MAKER).toBe('maker');
    });
  });
});
