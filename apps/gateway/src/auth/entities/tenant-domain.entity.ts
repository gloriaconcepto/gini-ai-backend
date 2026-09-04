export interface TenantDomainMapping {
  id: string;
  domain: string;
  tenantId: string;
  tenantName: string;
  realm: string;
  clientId: string;
  loginTheme?: string;
  createdAt: Date;
  updatedAt: Date;
}
