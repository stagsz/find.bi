/**
 * Passport.js configuration for JWT authentication.
 *
 * Uses the passport-jwt strategy to authenticate requests
 * with Bearer tokens in the Authorization header.
 *
 * Integrates with the existing JwtService for token verification,
 * which uses RS256 asymmetric signing.
 */

import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, type StrategyOptions } from 'passport-jwt';
import { loadJwtConfig } from './jwt.config.js';
import type { UserRole } from '../services/jwt.service.js';

/**
 * Authenticated user payload attached to requests after successful authentication.
 */
export interface AuthenticatedUser {
  /** User ID from JWT 'sub' claim */
  id: string;

  /** User email from JWT payload */
  email: string;

  /** User role from JWT payload */
  role: UserRole;
}

/**
 * JWT payload structure from verified tokens.
 */
interface JwtPayloadFromToken {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Configure Passport with JWT strategy.
 *
 * This strategy:
 * 1. Extracts JWT from Authorization header as Bearer token
 * 2. Verifies the token signature using the public key (RS256)
 * 3. Validates issuer and audience claims
 * 4. Only accepts 'access' tokens (rejects 'refresh' tokens)
 * 5. Returns the authenticated user payload
 *
 * @throws Error if JWT configuration is missing
 */
export function configurePassport(): void {
  const jwtConfig = loadJwtConfig();

  const options: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtConfig.publicKey,
    algorithms: ['RS256'],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  };

  passport.use(
    'jwt',
    new JwtStrategy(options, (payload: JwtPayloadFromToken, done) => {
      try {
        // Reject refresh tokens - only access tokens allowed for API auth
        if (payload.type !== 'access') {
          return done(null, false, { message: 'Invalid token type' });
        }

        // Validate required claims
        if (!payload.sub || !payload.email || !payload.role) {
          return done(null, false, { message: 'Token missing required claims' });
        }

        // Create authenticated user object
        const user: AuthenticatedUser = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    })
  );
}

/**
 * Initialize Passport in the Express application.
 * Should be called after configurePassport().
 *
 * @returns Passport middleware for Express
 */
export function initializePassport(): ReturnType<typeof passport.initialize> {
  return passport.initialize();
}

/**
 * Get the configured passport instance.
 * Useful for testing or direct access.
 */
export { passport };
