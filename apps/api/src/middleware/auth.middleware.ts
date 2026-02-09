/**
 * Authentication middleware for protecting routes.
 *
 * Provides:
 * - authenticate: Passport JWT authentication middleware (silent - just sets req.user)
 * - requireAuth: Ensures user is authenticated, returns 401 if not
 *
 * Usage:
 * ```ts
 * import { authenticate, requireAuth } from './middleware/auth.middleware.js';
 *
 * // Protect a single route
 * router.get('/profile', authenticate, requireAuth, handler);
 *
 * // Protect all routes in a router
 * router.use(authenticate, requireAuth);
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import type { AuthenticatedUser } from '../config/passport.config.js';

/**
 * Passport JWT authentication middleware.
 *
 * Extracts and verifies the JWT from the Authorization header.
 * On success, attaches the authenticated user to req.user.
 * On failure, req.user remains undefined and calls next() without sending response.
 *
 * This is a "silent" authentication - it does not send 401 responses.
 * Use this with requireAuth to enforce authentication with proper error responses.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: Error | null, user: AuthenticatedUser | false) => {
      if (err) {
        return next(err);
      }
      // If authentication failed, user will be false - just don't set req.user
      if (user) {
        req.user = user;
      }
      next();
    }
  )(req, res, next);
}

/**
 * Middleware that requires authentication.
 *
 * Should be used after `authenticate` middleware.
 * Returns 401 Unauthorized if user is not authenticated.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      },
    });
    return;
  }
  next();
}

/**
 * Type guard to check if request has an authenticated user.
 *
 * @param req - Express request object
 * @returns True if req.user is defined
 */
export function isAuthenticated(req: Request): req is Request & { user: AuthenticatedUser } {
  return req.user !== undefined;
}

/**
 * Get the authenticated user from the request.
 *
 * @param req - Express request object
 * @returns The authenticated user or undefined
 */
export function getAuthUser(req: Request): AuthenticatedUser | undefined {
  return req.user;
}

/**
 * Get the authenticated user ID from the request.
 *
 * @param req - Express request object
 * @returns The authenticated user ID or undefined
 */
export function getAuthUserId(req: Request): string | undefined {
  return req.user?.id;
}
