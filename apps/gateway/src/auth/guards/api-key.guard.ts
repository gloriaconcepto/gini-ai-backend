import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyService } from '../services/api-key.service';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { API_KEY_CONFIG } from '../constants/auth.constants';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const authHeader = request.headers['authorization'];
    const apiKeyHeader = request.headers[API_KEY_CONFIG.HEADER_NAME] as string;

    let apiKey = apiKeyHeader;
    if (
      !apiKey &&
      authHeader &&
      authHeader.startsWith(API_KEY_CONFIG.AUTH_SCHEME)
    ) {
      apiKey = authHeader.replace(API_KEY_CONFIG.AUTH_SCHEME, '').trim();
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
      userId: `${API_KEY_CONFIG.USER_ID_PREFIX}${result.record.id}`,
      username: result.record.name,
      tenantId: result.record.tenantId,
      roles: [...API_KEY_CONFIG.DEFAULT_ROLES],
      issuer: API_KEY_CONFIG.ISSUER,
    };

    return true;
  }
}
