/**
 * Project status definitions for HazOp Assistant.
 *
 * - planning: Initial setup, P&ID upload
 * - active: Analysis in progress
 * - review: Analysis complete, awaiting approval
 * - completed: Approved and finalized
 * - archived: Historical record
 */
export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'review'
  | 'completed'
  | 'archived';

/**
 * All available project statuses as a constant array.
 * Useful for validation, dropdowns, and iteration.
 */
export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'planning',
  'active',
  'review',
  'completed',
  'archived',
] as const;

/**
 * Project entity representing a HazOps study project.
 */
export interface Project {
  /** Unique identifier (UUID) */
  id: string;

  /** Project name */
  name: string;

  /** Project description */
  description: string;

  /** Current status of the project */
  status: ProjectStatus;

  /** ID of the user who created the project */
  createdById: string;

  /** Organization the project belongs to */
  organization: string;

  /** Timestamp when the project was created */
  createdAt: Date;

  /** Timestamp when the project was last updated */
  updatedAt: Date;
}

/**
 * Project with creator information (for display purposes).
 */
export interface ProjectWithCreator extends Project {
  /** Name of the user who created the project */
  createdByName: string;

  /** Email of the user who created the project */
  createdByEmail: string;
}

/**
 * Member role within a project.
 *
 * - owner: Project creator, full control
 * - lead: Can manage analysis and team
 * - member: Can contribute to analysis
 * - viewer: Read-only access
 */
export type ProjectMemberRole = 'owner' | 'lead' | 'member' | 'viewer';

/**
 * All available project member roles as a constant array.
 */
export const PROJECT_MEMBER_ROLES: readonly ProjectMemberRole[] = [
  'owner',
  'lead',
  'member',
  'viewer',
] as const;

/**
 * Project member entity representing a user's membership in a project.
 */
export interface ProjectMember {
  /** Unique identifier (UUID) */
  id: string;

  /** ID of the project */
  projectId: string;

  /** ID of the user */
  userId: string;

  /** Role of the member within the project */
  role: ProjectMemberRole;

  /** Timestamp when the member was added */
  joinedAt: Date;
}

/**
 * Project member with user details (for display purposes).
 */
export interface ProjectMemberWithUser extends ProjectMember {
  /** Name of the user */
  userName: string;

  /** Email of the user */
  userEmail: string;
}

/**
 * Payload for creating a new project.
 */
export interface CreateProjectPayload {
  name: string;
  description: string;
  organization: string;
}

/**
 * Payload for updating an existing project.
 * All fields are optional - only provided fields are updated.
 */
export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * Payload for adding a member to a project.
 */
export interface AddProjectMemberPayload {
  userId: string;
  role: ProjectMemberRole;
}

/**
 * Payload for updating a project member's role.
 */
export interface UpdateProjectMemberRolePayload {
  role: ProjectMemberRole;
}
