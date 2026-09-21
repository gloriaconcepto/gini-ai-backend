import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import {
  isMasterRealmIssuer,
  ROLE_NAMES,
} from '../../auth/constants/auth.constants';

@Injectable()
export class AuditorGuard implements CanActivate {
  private static readonly READ_ONLY_METHODS = new Set([
    'GET',
    'HEAD',
    'OPTIONS',
  ]);

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return true; // Let authentication guard handle missing user
    }

    const roles = user.roles || [];
    const isAuditor = roles.includes(ROLE_NAMES.GOVERNANCE_ROLES.AUDITOR);
    const isAdmin = roles.includes(ROLE_NAMES.GOVERNANCE_ROLES.ADMIN);
    const isMasterAdmin = isMasterRealmIssuer(user.issuer);

    // If user is exclusively an auditor (and not an admin)
    if (isAuditor && !isAdmin && !isMasterAdmin) {
      if (!AuditorGuard.READ_ONLY_METHODS.has(request.method)) {
        throw new ForbiddenException(
          'Auditor role is strictly restricted to read-only access (GET/HEAD)',
        );
      }
    }

    return true;
  }
}
