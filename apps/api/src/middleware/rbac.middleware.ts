/**
 * Role-Based Access Control (RBAC) middleware for route authorization.
 *
 * Provides middleware factories for checking user roles on protected routes.
 * Should be used after `authenticate` and `requireAuth` middleware.
 *
 * Roles (from least to most privileged):
 * - viewer: Read-only access to projects and reports
 * - analyst: Conduct HazOps analyses, create reports
 * - lead_analyst: Project management, analysis review/approval
 * - administrator: Full system access, user management
 *
 * Usage:
 * ```ts
 * import { authenticate, requireAuth } from './middleware/auth.middleware.js';
 * import { requireRole, requireAnyRole } from './middleware/rbac.middleware.js';
 *
 * // Single role required
 * router.get('/admin', authenticate, requireAuth, requireRole('administrator'), handler);
 *
 * // Any of multiple roles allowed
 * router.get('/manage', authenticate, requireAuth, requireAnyRole(['administrator', 'lead_analyst']), handler);
 *
 * // Shorthand for single role (also works with array)
 * router.get('/analyze', authenticate, requireAuth, requireRole('analyst'), handler);
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@hazop/types';
import type { AuthenticatedUser } from '../config/passport.config.js';

/**
 * Middleware factory that requires the user to have a specific role.
 *
 * Returns 403 Forbidden if the user does not have the required role.
 * Must be used after `authenticate` and `requireAuth` middleware.
 *
 * @param role - The role required to access the route
 * @returns Express middleware function
 *
 * @example
 * router.get('/admin-only', authenticate, requireAuth, requireRole('administrator'), handler);
 */
export function requireRole(role: UserRole): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (user.role !== role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${role}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory that requires the user to have any of the specified roles.
 *
 * Returns 403 Forbidden if the user does not have at least one of the required roles.
 * Must be used after `authenticate` and `requireAuth` middleware.
 *
 * @param roles - Array of roles, any of which grants access
 * @returns Express middleware function
 *
 * @example
 * router.get('/management', authenticate, requireAuth, requireAnyRole(['administrator', 'lead_analyst']), handler);
 */
export function requireAnyRole(roles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${roles.join(' or ')}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Minimum role level middleware factory.
 *
 * Grants access if the user's role is at or above the specified level.
 * Role hierarchy (lowest to highest): viewer < analyst < lead_analyst < administrator
 *
 * @param minimumRole - The minimum role level required
 * @returns Express middleware function
 *
 * @example
 * // Allows analyst, lead_analyst, and administrator
 * router.get('/analyze', authenticate, requireAuth, requireMinimumRole('analyst'), handler);
 */
export function requireMinimumRole(minimumRole: UserRole): (req: Request, res: Response, next: NextFunction) => void {
  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    analyst: 2,
    lead_analyst: 3,
    administrator: 4,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required',
        },
      });
      return;
    }

    const userLevel = roleHierarchy[user.role] ?? 0;
    const requiredLevel = roleHierarchy[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Minimum required role: ${minimumRole}`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Check if a user has a specific role.
 *
 * Utility function for checking roles in controllers or services.
 *
 * @param user - The authenticated user object
 * @param role - The role to check for
 * @returns True if the user has the specified role
 */
export function hasRole(user: AuthenticatedUser | undefined, role: UserRole): boolean {
  return user?.role === role;
}

/**
 * Check if a user has any of the specified roles.
 *
 * Utility function for checking roles in controllers or services.
 *
 * @param user - The authenticated user object
 * @param roles - Array of roles to check
 * @returns True if the user has any of the specified roles
 */
export function hasAnyRole(user: AuthenticatedUser | undefined, roles: UserRole[]): boolean {
  return user !== undefined && roles.includes(user.role);
}

/**
 * Check if a user meets or exceeds a minimum role level.
 *
 * Role hierarchy (lowest to highest): viewer < analyst < lead_analyst < administrator
 *
 * @param user - The authenticated user object
 * @param minimumRole - The minimum role level to check
 * @returns True if the user's role is at or above the minimum level
 */
export function hasMinimumRole(user: AuthenticatedUser | undefined, minimumRole: UserRole): boolean {
  if (!user) return false;

  const roleHierarchy: Record<UserRole, number> = {
    viewer: 1,
    analyst: 2,
    lead_analyst: 3,
    administrator: 4,
  };

  const userLevel = roleHierarchy[user.role] ?? 0;
  const requiredLevel = roleHierarchy[minimumRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if a user is an administrator.
 *
 * Shorthand for hasRole(user, 'administrator').
 *
 * @param user - The authenticated user object
 * @returns True if the user is an administrator
 */
export function isAdmin(user: AuthenticatedUser | undefined): boolean {
  return user?.role === 'administrator';
}
