import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKeyProvider: (request: any, rawJwtToken: string, done: any) => {
        try {
          const decoded = jwt.decode(rawJwtToken, { complete: true });
          if (!decoded || typeof decoded === 'string' || !decoded.payload) {
            return done(new Error('Invalid token format'));
          }

          const issuer = (decoded.payload as any).iss;
          if (!issuer) {
            return done(new Error('No issuer found in token'));
          }

          // Fetch the JWKS from the token's issuer (works across dynamically provisioned tenant realms)
          const client = new JwksClient({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri: `${issuer}/protocol/openid-connect/certs`,
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

  async validate(request: any, payload: any) {
    return {
      userId: payload.sub,
      username: payload.preferred_username,
      tenantId: payload.tenant_id,
      roles: payload.realm_access?.roles || [],
      issuer: payload.iss,
    };
  }
}
