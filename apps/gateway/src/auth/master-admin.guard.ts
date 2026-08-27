import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class MasterAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context not found');
    }

    // Must belong to the master realm
    if (!user.issuer || !user.issuer.endsWith('/realms/master')) {
      throw new ForbiddenException('Access denied: Requires Keycloak Master Realm administrator privileges');
    }

    // Must have the master realm's admin role
    if (!user.roles || !user.roles.includes('admin')) {
      throw new ForbiddenException('Access denied: User does not have the admin role in the master realm');
    }

    return true;
  }
}
