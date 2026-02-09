/**
 * User role definitions for HazOp Assistant.
 *
 * - administrator: Full system access, user management
 * - lead_analyst: Project management, analysis review/approval
 * - analyst: Conduct HazOps analyses, create reports
 * - viewer: Read-only access to projects and reports
 */
export type UserRole = 'administrator' | 'lead_analyst' | 'analyst' | 'viewer';

/**
 * All available user roles as a constant array.
 * Useful for validation, dropdowns, and iteration.
 */
export const USER_ROLES: readonly UserRole[] = [
  'administrator',
  'lead_analyst',
  'analyst',
  'viewer',
] as const;

/**
 * User entity representing an authenticated user in the system.
 */
export interface User {
  /** Unique identifier (UUID) */
  id: string;

  /** User's email address (unique, used for authentication) */
  email: string;

  /** User's display name */
  name: string;

  /** User's role determining permissions */
  role: UserRole;

  /** Organization the user belongs to */
  organization: string;

  /** Whether the user account is active */
  isActive: boolean;

  /** Timestamp when the user was created */
  createdAt: Date;

  /** Timestamp when the user was last updated */
  updatedAt: Date;
}

/**
 * User entity with password hash (for backend/database use only).
 * Never expose password_hash to the frontend.
 */
export interface UserWithPassword extends User {
  /** Hashed password (bcrypt) - never expose to clients */
  passwordHash: string;
}

/**
 * Payload for creating a new user.
 */
export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  organization: string;
}

/**
 * Payload for updating an existing user.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  organization?: string;
  isActive?: boolean;
}

/**
 * Payload for admin to update a user's role.
 */
export interface UpdateUserRolePayload {
  role: UserRole;
}

/**
 * Payload for admin to update a user's status.
 */
export interface UpdateUserStatusPayload {
  isActive: boolean;
}
