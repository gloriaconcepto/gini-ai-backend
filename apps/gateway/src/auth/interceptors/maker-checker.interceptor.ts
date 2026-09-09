import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { REQUIRE_DUAL_CONTROL_KEY } from '../decorators/require-dual-control.decorator';
import {
  ChangeRequestActionType,
  ChangeRequest,
} from '../entities/change-request.entity';
import { ChangeRequestStoreService } from '../services/change-request-store.service';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };

@Injectable()
export class MakerCheckerInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly storeService: ChangeRequestStoreService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const actionType =
      this.reflector.getAllAndOverride<ChangeRequestActionType>(
        REQUIRE_DUAL_CONTROL_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!actionType) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthRequest>();
    const response = http.getResponse<ExpressResponse>();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('User authentication context not found');
    }

    const hasMakerRole = user.roles.some(
      (role) => role.toLowerCase() === 'maker',
    );

    if (!hasMakerRole) {
      throw new ForbiddenException(
        'Only makers can initiate dual-control change requests',
      );
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant context is required for dual-control change requests',
      );
    }

    const params = request.params || {};
    const rawTargetId =
      params.userId || params.roleName || params.id || params.alias;
    const targetResourceId = Array.isArray(rawTargetId)
      ? rawTargetId[0]
      : rawTargetId;

    let targetResource = 'general';
    if (actionType.includes('USER') || actionType.includes('PASSWORD')) {
      targetResource = 'users';
    } else if (actionType.includes('ROLE')) {
      targetResource = 'roles';
    } else if (actionType.includes('CLIENT')) {
      targetResource = 'clients';
    } else if (actionType.includes('IDP')) {
      targetResource = 'idp';
    }

    const changeRequest: ChangeRequest = this.storeService.create({
      tenantId,
      actionType,
      targetResource,
      targetResourceId,
      payload: {
        body: (request.body ?? {}) as Record<string, unknown>,
        params: (request.params ?? {}) as Record<string, string>,
        query: (request.query ?? {}) as Record<string, unknown>,
      },
      makerId: user.userId,
      makerUsername: user.username,
    });

    response.status(HttpStatus.ACCEPTED);
    return of(changeRequest);
  }
}
