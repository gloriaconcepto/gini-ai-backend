import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

import { Request } from 'express';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { isMasterRealmIssuer, ROLE_NAMES } from '../constants/auth.constants';

@Injectable()
export class MasterAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // Must belong to the master realm
    if (!isMasterRealmIssuer(user.issuer)) {
      throw new ForbiddenException(
        'Access denied: Requires Keycloak Master Realm administrator privileges',
      );
    }

    // Must have the master realm's admin role
    const isMasterAdmin =
      user.roles &&
      ROLE_NAMES.MASTER_ADMIN_ROLES.some((role) => user.roles.includes(role));

    if (!isMasterAdmin) {
      throw new ForbiddenException(
        'Access denied: User does not have the admin role in the master realm',
      );
    }

    return true;
  }
}
