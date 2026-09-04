import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { KeycloakService } from './keycloak.service';
import { TenantDomainMapping } from '../entities/tenant-domain.entity';
import { TenantResolutionResponseDto } from '../dto/tenant-resolution.dto';

@Injectable()
export class TenantDomainService {
  private readonly logger = new Logger(TenantDomainService.name);

  // In-memory mapping table for Phase 1 (persisted to Drizzle ORM in Phase 2 / Epic 3)
  private readonly domainTable = new Map<string, TenantDomainMapping>();

  constructor(
    private readonly configService: ConfigService,
    private readonly keycloakService: KeycloakService,
  ) {}

  /**
   * Normalizes an input string to an exact lowercase domain name.
   * Handles user emails (e.g. user@acme.com -> acme.com), URLs, ports, and paths.
   */
  normalizeDomain(input: string): string {
    if (!input) return '';
    let cleaned = input.trim().toLowerCase();

    // If an email address was passed, extract the domain part after '@'
    if (cleaned.includes('@')) {
      cleaned = cleaned.split('@').pop() || '';
    }

    // Strip URL protocols if included (e.g. https://acme.com)
    cleaned = cleaned.replace(/^https?:\/\//, '');

    // Strip port and URL paths if included (e.g. acme.com:3000/login)
    cleaned = cleaned.split('/')[0].split(':')[0];

    return cleaned;
  }

  /**
   * Registers a domain-to-tenant mapping in the table.
   */
  registerDomain(
    tenantId: string,
    tenantName: string,
    domain: string,
    clientId = 'gini-frontend',
    loginTheme = 'gini-theme',
  ): TenantDomainMapping {
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new Error('Domain name cannot be empty');
    }

    const now = new Date();
    const existing = this.domainTable.get(normalizedDomain);

    const record: TenantDomainMapping = {
      id: existing?.id || randomUUID(),
      domain: normalizedDomain,
      tenantId,
      tenantName,
      realm: `tenant-${tenantId}`,
      clientId,
      loginTheme,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.domainTable.set(normalizedDomain, record);
    this.logger.log(
      `Registered domain '${normalizedDomain}' for tenant '${tenantName}' (${tenantId})`,
    );
    return record;
  }

  /**
   * Resolves a tenant workspace from a corporate domain or user email address.
   * First checks the domain mapping table; falls back to Keycloak realm attributes if not yet cached.
   */
  async resolveDomain(
    domainOrEmail: string,
  ): Promise<TenantResolutionResponseDto> {
    const domain = this.normalizeDomain(domainOrEmail);
    if (!domain) {
      throw new NotFoundException('A valid domain or email must be provided');
    }

    // 1. Check in-memory mapping table
    const cached = this.domainTable.get(domain);
    if (cached) {
      return this.toResponseDto(cached);
    }

    // 2. Fallback: Search Keycloak realms for attributes.domainName
    try {
      const realms = await this.keycloakService.listAllTenants();
      const matchedRealm = (realms || []).find((r) => {
        const attrDomain = r.attributes?.domainName;
        const realmDomain = Array.isArray(attrDomain)
          ? attrDomain[0]
          : attrDomain;
        return (
          typeof realmDomain === 'string' &&
          this.normalizeDomain(realmDomain) === domain
        );
      });

      if (matchedRealm && matchedRealm.realm) {
        const tenantId = matchedRealm.realm.replace(/^tenant-/, '');
        const tenantName =
          matchedRealm.displayName || matchedRealm.realm || tenantId;

        // Auto-cache discovered realm in table for fast subsequent lookups
        const record = this.registerDomain(
          tenantId,
          tenantName,
          domain,
          'gini-frontend',
          matchedRealm.loginTheme || 'gini-theme',
        );

        return this.toResponseDto(record);
      }
    } catch (error) {
      this.logger.warn(
        `Failed fallback Keycloak lookup for domain '${domain}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    throw new NotFoundException(
      `Tenant workspace for domain '${domain}' not found`,
    );
  }

  /**
   * Removes a domain mapping from the table.
   */
  removeDomain(domain: string): boolean {
    const normalized = this.normalizeDomain(domain);
    return this.domainTable.delete(normalized);
  }

  /**
   * Lists all domain mappings associated with a specific tenant.
   */
  listDomainsForTenant(tenantId: string): TenantDomainMapping[] {
    return Array.from(this.domainTable.values()).filter(
      (m) => m.tenantId === tenantId,
    );
  }

  private toResponseDto(
    mapping: TenantDomainMapping,
  ): TenantResolutionResponseDto {
    const baseUrl = this.configService
      .get<string>('KEYCLOAK_URL', 'http://localhost:8080')
      .replace(/\/$/, '');

    return {
      tenantId: mapping.tenantId,
      tenantName: mapping.tenantName,
      realm: mapping.realm,
      clientId: mapping.clientId,
      keycloakUrl: `${baseUrl}/realms/${mapping.realm}`,
      loginTheme: mapping.loginTheme,
    };
  }
}
