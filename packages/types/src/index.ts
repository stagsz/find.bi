/**
 * @hazop/types - Shared TypeScript type definitions for HazOp Assistant
 *
 * This package contains all shared type definitions used across the
 * HazOp Assistant monorepo, including types for:
 * - User management and authentication
 * - Projects and project members
 * - P&ID documents and analysis nodes
 * - HazOps analysis and risk assessment
 * - Reports and compliance
 */

// User and authentication types
export type {
  UserRole,
  User,
  UserWithPassword,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateUserRolePayload,
  UpdateUserStatusPayload,
} from './user.js';

export { USER_ROLES } from './user.js';
