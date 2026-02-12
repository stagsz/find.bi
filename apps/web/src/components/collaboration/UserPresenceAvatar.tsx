/**
 * User presence avatar component for showing collaborators.
 *
 * Lightweight avatar component designed for embedding in the analysis workspace
 * to show which users are viewing nodes or editing fields.
 *
 * @module components/collaboration/UserPresenceAvatar
 */

import { Tooltip } from '@mantine/core';
import type { CursorPosition, UserPresence } from '../../hooks/useWebSocket';

// ============================================================================
// Types
// ============================================================================

type AvatarSize = 'xs' | 'sm' | 'md';

interface UserPresenceAvatarProps {
  /** User to display */
  user: UserPresence;
  /** Whether this is the current user */
  isCurrentUser?: boolean;
  /** Size variant */
  size?: AvatarSize;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface UserPresenceAvatarGroupProps {
  /** Users to display */
  users: UserPresence[];
  /** Current user's ID (to identify self) */
  currentUserId?: string;
  /** Maximum number to show before +N */
  maxShown?: number;
  /** Size variant */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
}

interface NodePresenceAvatarsProps {
  /** All users in the collaboration room */
  users: UserPresence[];
  /** Node ID to filter by */
  nodeId: string;
  /** Current user's ID */
  currentUserId?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
}

interface FieldPresenceAvatarsProps {
  /** All users in the collaboration room */
  users: UserPresence[];
  /** Entry ID to filter by (optional) */
  entryId?: string;
  /** Field name to filter by (optional) */
  field?: string;
  /** Current user's ID */
  currentUserId?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const AVATAR_SIZES: Record<AvatarSize, string> = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-6 h-6 text-xs',
};

const AVATAR_OVERLAP: Record<AvatarSize, string> = {
  xs: '-ml-1',
  sm: '-ml-1.5',
  md: '-ml-2',
};

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from an email address.
 */
function getInitials(email: string): string {
  const localPart = email.split('@')[0] || '';
  const parts = localPart.split(/[.\-_]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return localPart.slice(0, 2).toUpperCase();
}

/**
 * Get a consistent color for a user based on their ID.
 */
function getAvatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Check if user is currently active (within 5 minutes).
 */
function isUserActive(lastActivity: string): boolean {
  const activityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  return now - activityTime < 5 * 60 * 1000;
}

/**
 * Get a readable description of what user is doing.
 */
function getUserActivity(cursor?: CursorPosition): string {
  if (!cursor) return 'Connected';
  if (cursor.field) return `Editing ${cursor.field}`;
  if (cursor.entryId) return 'Editing entry';
  if (cursor.nodeId) return `Viewing node ${cursor.nodeId}`;
  return 'Connected';
}

// ============================================================================
// Components
// ============================================================================

/**
 * Single user presence avatar.
 */
export function UserPresenceAvatar({
  user,
  isCurrentUser = false,
  size = 'sm',
  showTooltip = true,
  className = '',
}: UserPresenceAvatarProps) {
  const initials = getInitials(user.email);
  const color = getAvatarColor(user.userId);
  const isActive = isUserActive(user.lastActivity);

  const avatar = (
    <div
      className={`
        ${AVATAR_SIZES[size]}
        ${color.bg}
        ${color.text}
        rounded-full flex items-center justify-center font-semibold
        border border-white shadow-sm
        ${isCurrentUser ? 'ring-1 ring-blue-400' : ''}
        ${!isActive ? 'opacity-60' : ''}
        ${className}
      `}
    >
      {initials}
    </div>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <Tooltip
      label={
        <div className="text-xs">
          <div className="font-medium">
            {user.email}
            {isCurrentUser && ' (you)'}
          </div>
          <div className="text-slate-300">{getUserActivity(user.cursor)}</div>
        </div>
      }
      position="top"
      withArrow
    >
      {avatar}
    </Tooltip>
  );
}

/**
 * Group of user presence avatars with overlap.
 */
export function UserPresenceAvatarGroup({
  users,
  currentUserId,
  maxShown = 3,
  size = 'sm',
  className = '',
}: UserPresenceAvatarGroupProps) {
  if (users.length === 0) {
    return null;
  }

  // Sort: current user first, then by activity
  const sortedUsers = [...users].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  const visibleUsers = sortedUsers.slice(0, maxShown);
  const overflowCount = users.length - maxShown;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {visibleUsers.map((user, index) => (
        <UserPresenceAvatar
          key={user.userId}
          user={user}
          isCurrentUser={user.userId === currentUserId}
          size={size}
          className={index > 0 ? AVATAR_OVERLAP[size] : ''}
        />
      ))}
      {overflowCount > 0 && (
        <Tooltip
          label={
            <div className="text-xs">
              {sortedUsers.slice(maxShown).map((u) => (
                <div key={u.userId}>{u.email}</div>
              ))}
            </div>
          }
          position="top"
          withArrow
        >
          <div
            className={`
              ${AVATAR_SIZES[size]}
              ${AVATAR_OVERLAP[size]}
              bg-slate-100 text-slate-600
              rounded-full flex items-center justify-center font-semibold
              border border-white shadow-sm
            `}
          >
            +{overflowCount}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Presence avatars for users viewing a specific node.
 */
export function NodePresenceAvatars({
  users,
  nodeId,
  currentUserId,
  size = 'xs',
  className = '',
}: NodePresenceAvatarsProps) {
  // Filter to users viewing this node (excluding current user)
  const nodeUsers = users.filter(
    (u) => u.cursor?.nodeId === nodeId && u.userId !== currentUserId
  );

  if (nodeUsers.length === 0) {
    return null;
  }

  return (
    <UserPresenceAvatarGroup
      users={nodeUsers}
      currentUserId={currentUserId}
      maxShown={2}
      size={size}
      className={className}
    />
  );
}

/**
 * Presence avatars for users editing a specific field.
 */
export function FieldPresenceAvatars({
  users,
  entryId,
  field,
  currentUserId,
  size = 'xs',
  className = '',
}: FieldPresenceAvatarsProps) {
  // Filter to users editing this field (excluding current user)
  const fieldUsers = users.filter((u) => {
    if (u.userId === currentUserId) return false;
    if (!u.cursor) return false;
    // Match by entry + field if both provided
    if (entryId && field) {
      return u.cursor.entryId === entryId && u.cursor.field === field;
    }
    // Match by field name only if no entryId
    if (field) {
      return u.cursor.field === field;
    }
    // Match by entryId only if no field
    if (entryId) {
      return u.cursor.entryId === entryId;
    }
    return false;
  });

  if (fieldUsers.length === 0) {
    return null;
  }

  return (
    <UserPresenceAvatarGroup
      users={fieldUsers}
      currentUserId={currentUserId}
      maxShown={2}
      size={size}
      className={className}
    />
  );
}

/**
 * Compact presence indicator showing count of users.
 */
export function PresenceCount({
  count,
  label = 'editing',
  className = '',
}: {
  count: number;
  label?: string;
  className?: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
        bg-blue-50 text-blue-700 border border-blue-200
        ${className}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      {count} {label}
    </span>
  );
}

export default UserPresenceAvatar;
