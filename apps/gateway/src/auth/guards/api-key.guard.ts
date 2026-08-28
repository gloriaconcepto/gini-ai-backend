import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../services/api-key.service';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers['x-api-key'] as string;

    let apiKey = apiKeyHeader;
    if (!apiKey && authHeader && authHeader.startsWith('ApiKey ')) {
      apiKey = authHeader.replace('ApiKey ', '').trim();
    }

    if (!apiKey) {
      throw new UnauthorizedException('API key missing from headers');
    }

    const result = await this.apiKeyService.validateApiKey(apiKey);
    if (!result.valid || !result.record) {
      throw new UnauthorizedException('Invalid, expired, or revoked API key');
    }

    // Set authenticated user context
    request.user = {
      userId: `apikey-${result.record.id}`,
      username: result.record.name,
      tenantId: result.record.tenantId,
      roles: ['service', 'admin'],
      issuer: 'local-api-key',
    };

    return true;
  }
}
