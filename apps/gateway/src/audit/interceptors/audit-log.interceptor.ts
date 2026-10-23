import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import {
  AuditActionCategory,
  AuditActor,
  AuditDecoratorOptions,
  AuditStatus,
} from '../audit.types';
import { AuditService } from '../services/audit.service';
import {
  AUDIT_METADATA_KEY,
  SKIP_AUDIT_METADATA_KEY,
} from '../decorators/audited.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private static readonly MUTATING_METHODS = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 1. Check for @SkipAudit()
    const skipAudit = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipAudit) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const response = httpContext.getResponse<Response>();

    // 2. Check for @Audited() metadata
    const auditOptions = this.reflector.getAllAndOverride<
      AuditDecoratorOptions | undefined
    >(AUDIT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    const isMutating = AuditLogInterceptor.MUTATING_METHODS.has(request.method);

    // Only audit if explicitly annotated or if mutating HTTP request
    if (!auditOptions && !isMutating) {
      return next.handle();
    }

    const startTime = Date.now();
    const traceId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      randomUUID();

    const actor = this.extractActor(request);
    const tenantId =
      actor.tenantId || (request.headers['x-tenant-id'] as string) || 'system';

    const category = this.resolveCategory(auditOptions, request.path);
    const routeObj = request.route as { path?: string } | undefined;
    const routePath = routeObj?.path || request.path;
    const operation =
      auditOptions?.operation || `${request.method}_${routePath}`;
    const resourceType =
      auditOptions?.resourceType || this.inferResourceType(request.path);
    const resourceId = auditOptions?.extractResourceId
      ? auditOptions.extractResourceId(request)
      : this.extractResourceId(request);

    return next.handle().pipe(
      tap((responseData: unknown) => {
        const durationMs = Date.now() - startTime;
        const statusCode =
          response.statusCode || (request.method === 'POST' ? 201 : 200);

        void this.auditService.recordLog({
          tenantId,
          traceId,
          actor,
          category,
          operation,
          httpMethod: request.method,
          routePath,
          resourceType,
          resourceId,
          statusCode,
          durationMs,
          status: AuditStatus.SUCCESS,
          payload:
            request.body && typeof request.body === 'object'
              ? (request.body as Record<string, unknown>)
              : undefined,
          metadata: {
            queryParams: Object.keys(request.query || {}).length
              ? request.query
              : undefined,
            responseSummary:
              responseData && typeof responseData === 'object'
                ? { keys: Object.keys(responseData) }
                : undefined,
          },
        });
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startTime;
        const errObj = error as {
          status?: number;
          statusCode?: number;
          message?: string;
        };
        const statusCode = errObj.status || errObj.statusCode || 500;
        const status =
          statusCode === 401 || statusCode === 403
            ? AuditStatus.DENIED
            : AuditStatus.FAILURE;
        const errorMessage = errObj.message || 'Internal server error';

        void this.auditService.recordLog({
          tenantId,
          traceId,
          actor,
          category,
          operation,
          httpMethod: request.method,
          routePath,
          resourceType,
          resourceId,
          statusCode,
          durationMs,
          status,
          payload:
            request.body && typeof request.body === 'object'
              ? (request.body as Record<string, unknown>)
              : undefined,
          errorMessage,
          metadata: {
            queryParams: Object.keys(request.query || {}).length
              ? request.query
              : undefined,
          },
        });

        throw error;
      }),
    );
  }

  private extractActor(
    request: Request & { user?: AuthenticatedUser },
  ): AuditActor {
    const user = request.user;
    if (user) {
      const isApiKey = user.issuer === 'local-api-key';
      return {
        actorId: user.userId,
        actorType: isApiKey ? 'API_KEY' : 'USER',
        username: user.username,
        tenantId: user.tenantId,
        roles: user.roles || [],
        ipAddress: request.ip || request.socket?.remoteAddress,
        userAgent: request.headers['user-agent'],
      };
    }

    return {
      actorId: 'anonymous',
      actorType: 'ANONYMOUS',
      roles: [],
      ipAddress: request.ip || request.socket?.remoteAddress,
      userAgent: request.headers['user-agent'],
    };
  }

  private resolveCategory(
    options: AuditDecoratorOptions | undefined,
    path: string,
  ): AuditActionCategory {
    if (options?.category) {
      return options.category;
    }
    if (path.startsWith('/system')) {
      return AuditActionCategory.SYSTEM;
    }
    if (path.startsWith('/api-keys')) {
      return AuditActionCategory.API_KEY;
    }
    if (path.startsWith('/tenant')) {
      return AuditActionCategory.AUTH;
    }
    return AuditActionCategory.IAM;
  }

  private inferResourceType(path: string): string {
    if (path.includes('/users')) return 'user';
    if (path.includes('/roles')) return 'role';
    if (path.includes('/clients')) return 'client';
    if (path.includes('/identity-providers') || path.includes('/idp'))
      return 'identity_provider';
    if (path.includes('/api-keys')) return 'api_key';
    if (path.includes('/tenants') || path.includes('/tenant')) return 'tenant';
    return 'general';
  }

  private extractResourceId(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined>;
    return (
      params.id ||
      params.userId ||
      params.realm ||
      params.roleName ||
      params.clientId ||
      params.alias ||
      params.keyId
    );
  }
}
