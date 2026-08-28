import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

export interface KeycloakJwtPayload {
  iss: string;
  sub: string;
  preferred_username: string;
  tenant_id?: string;
  realm_access?: {
    roles: string[];
  };
}

export interface AuthenticatedUser {
  userId: string;
  username: string;
  tenantId?: string;
  roles: string[];
  issuer: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKeyProvider: (
        request: Request,
        rawJwtToken: string,
        done: (err: any, secret?: string) => void,
      ) => {
        try {
          const decoded = jwt.decode(rawJwtToken, { complete: true });
          if (!decoded || typeof decoded === 'string' || !decoded.payload) {
            return done(new Error('Invalid token format'));
          }

          const payload = decoded.payload as jwt.JwtPayload;
          const issuer = payload.iss;
          if (!issuer) {
            return done(new Error('No issuer found in token'));
          }

          let jwksUri = `${issuer}/protocol/openid-connect/certs`;

          // TODO: Remove or disable in production
          // Docker networking workaround: If the token was generated on the host machine (localhost),
          // the Gateway inside Docker needs to route it to the 'keycloak' service instead.
          if (
            process.env.NODE_ENV === 'development' &&
            process.env.KEYCLOAK_URL &&
            process.env.KEYCLOAK_URL.includes('keycloak')
          ) {
            jwksUri = jwksUri.replace('localhost:8080', 'keycloak:8080');
          }

          // Fetch the JWKS from the token's issuer
          const client = new JwksClient({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri,
          });

          const kid = decoded.header.kid;
          if (!kid) {
            return done(new Error('No kid found in token header'));
          }

          client.getSigningKey(kid, (err, key) => {
            if (err) {
              return done(err);
            }
            const signingKey = key?.getPublicKey();
            done(null, signingKey);
          });
        } catch (error) {
          done(error);
        }
      },
    });
  }

  validate(request: Request, payload: KeycloakJwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      username: payload.preferred_username,
      tenantId: payload.tenant_id,
      roles: payload.realm_access?.roles || [],
      issuer: payload.iss,
    };
  }
}
