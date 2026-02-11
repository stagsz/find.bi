/**
 * Socket.io type definitions for real-time collaboration.
 *
 * Defines typed events, payloads, and socket data structures
 * for the WebSocket communication layer.
 */

import type { UserRole } from '../services/jwt.service.js';

// ============================================================================
// Socket Authentication
// ============================================================================

/**
 * Authenticated user data attached to socket connections.
 */
export interface SocketUser {
  /** User ID from JWT */
  id: string;

  /** User email from JWT */
  email: string;

  /** User role from JWT */
  role: UserRole;
}

/**
 * Socket data persisted across the connection lifetime.
 */
export interface SocketData {
  /** Authenticated user information */
  user: SocketUser;

  /** Current analysis session the user is in (if any) */
  analysisId?: string;

  /** Current collaboration session ID (if any) */
  sessionId?: string;
}

// ============================================================================
// Socket Event Payloads
// ============================================================================

/**
 * Payload for joining a collaboration room.
 */
export interface JoinRoomPayload {
  /** Analysis ID to join */
  analysisId: string;
}

/**
 * Payload for leaving a collaboration room.
 */
export interface LeaveRoomPayload {
  /** Analysis ID to leave */
  analysisId: string;
}

/**
 * Cursor/focus position in the analysis workspace.
 */
export interface CursorPosition {
  /** Node ID the user is focused on (if any) */
  nodeId?: string;

  /** Entry ID the user is editing (if any) */
  entryId?: string;

  /** Field the user is editing (e.g., 'causes', 'consequences') */
  field?: string;
}

/**
 * Payload for cursor position updates.
 */
export interface CursorUpdatePayload {
  /** The user's current cursor position */
  position: CursorPosition;
}

/**
 * User presence information for collaboration awareness.
 */
export interface UserPresence {
  /** User ID */
  userId: string;

  /** User email */
  email: string;

  /** User's current cursor position */
  cursor?: CursorPosition;

  /** Last activity timestamp (ISO 8601) */
  lastActivity: string;
}

/**
 * Analysis entry update payload.
 */
export interface EntryUpdatePayload {
  /** Entry ID that was updated */
  entryId: string;

  /** The updated entry data (partial) */
  changes: Record<string, unknown>;

  /** User who made the change */
  userId: string;

  /** New version number after the update */
  version: number;
}

/**
 * Analysis entry created payload.
 */
export interface EntryCreatedPayload {
  /** The newly created entry */
  entry: Record<string, unknown>;

  /** User who created the entry */
  userId: string;
}

/**
 * Analysis entry deleted payload.
 */
export interface EntryDeletedPayload {
  /** Entry ID that was deleted */
  entryId: string;

  /** User who deleted the entry */
  userId: string;
}

/**
 * Risk ranking update payload.
 */
export interface RiskUpdatePayload {
  /** Entry ID that had risk updated */
  entryId: string;

  /** Updated risk data */
  risk: {
    severity?: number;
    likelihood?: number;
    detectability?: number;
    riskScore?: number;
    riskLevel?: string;
  };

  /** User who made the change */
  userId: string;
}

// ============================================================================
// Conflict Detection Payloads
// ============================================================================

/**
 * Entry data snapshot for conflict comparison.
 */
export interface ConflictEntrySnapshot {
  /** Entry ID */
  id: string;

  /** Current version number */
  version: number;

  /** Deviation description */
  deviation: string;

  /** Causes array */
  causes: string[];

  /** Consequences array */
  consequences: string[];

  /** Safeguards array */
  safeguards: string[];

  /** Recommendations array */
  recommendations: string[];

  /** Notes */
  notes: string | null;

  /** Severity (1-5) */
  severity: number | null;

  /** Likelihood (1-5) */
  likelihood: number | null;

  /** Detectability (1-5) */
  detectability: number | null;

  /** Calculated risk score */
  riskScore: number | null;

  /** Risk level classification */
  riskLevel: string | null;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Conflict detected payload.
 * Sent when a user's update conflicts with another user's changes.
 */
export interface ConflictDetectedPayload {
  /** Entry ID that has a conflict */
  entryId: string;

  /** Version the user expected */
  expectedVersion: number;

  /** Actual current version in the database */
  currentVersion: number;

  /** Current state of the entry on the server */
  serverData: ConflictEntrySnapshot;

  /** Changes the user was trying to make */
  clientChanges: Record<string, unknown>;

  /** User ID who made the conflicting update */
  conflictingUserId: string;

  /** Email of the user who made the conflicting update */
  conflictingUserEmail?: string;

  /** Timestamp when the conflict was detected (ISO 8601) */
  conflictedAt: string;
}

/**
 * Conflict resolved payload.
 * Sent when a conflict is resolved (either by accepting server or client version).
 */
export interface ConflictResolvedPayload {
  /** Entry ID that had the conflict resolved */
  entryId: string;

  /** Resolution strategy used */
  resolution: 'accept_server' | 'accept_client' | 'merge';

  /** The final entry data after resolution */
  finalData: ConflictEntrySnapshot;

  /** User who resolved the conflict */
  resolvedByUserId: string;

  /** Timestamp when resolved (ISO 8601) */
  resolvedAt: string;
}

// ============================================================================
// Socket Error Types
// ============================================================================

/**
 * Socket error codes.
 */
export type SocketErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHORIZED'
  | 'ROOM_NOT_FOUND'
  | 'NOT_IN_ROOM'
  | 'INVALID_PAYLOAD'
  | 'INTERNAL_ERROR';

/**
 * Socket error response.
 */
export interface SocketError {
  /** Error code */
  code: SocketErrorCode;

  /** Human-readable error message */
  message: string;
}

// ============================================================================
// Socket Event Maps (for typed Socket.io)
// ============================================================================

/**
 * Events emitted by the client to the server.
 */
export interface ClientToServerEvents {
  /** Join a collaboration room for an analysis */
  'room:join': (payload: JoinRoomPayload, callback: (error?: SocketError) => void) => void;

  /** Leave a collaboration room */
  'room:leave': (payload: LeaveRoomPayload, callback: (error?: SocketError) => void) => void;

  /** Update cursor/focus position */
  'cursor:update': (payload: CursorUpdatePayload) => void;

  /** Ping to keep connection alive */
  ping: (callback: () => void) => void;
}

/**
 * Events emitted by the server to clients.
 */
export interface ServerToClientEvents {
  /** User joined the room */
  'user:joined': (user: UserPresence) => void;

  /** User left the room */
  'user:left': (userId: string) => void;

  /** User's cursor position updated */
  'cursor:moved': (data: { userId: string; position: CursorPosition }) => void;

  /** Current users in the room (sent on join) */
  'room:users': (users: UserPresence[]) => void;

  /** Analysis entry was updated */
  'entry:updated': (payload: EntryUpdatePayload) => void;

  /** Analysis entry was created */
  'entry:created': (payload: EntryCreatedPayload) => void;

  /** Analysis entry was deleted */
  'entry:deleted': (payload: EntryDeletedPayload) => void;

  /** Risk ranking was updated */
  'risk:updated': (payload: RiskUpdatePayload) => void;

  /** Conflict detected for concurrent edit */
  'entry:conflict': (payload: ConflictDetectedPayload) => void;

  /** Conflict resolved */
  'entry:conflict-resolved': (payload: ConflictResolvedPayload) => void;

  /** Error notification */
  error: (error: SocketError) => void;

  /** Pong response */
  pong: () => void;
}

/**
 * Inter-server events (for multi-server deployments with adapter).
 */
export interface InterServerEvents {
  ping: () => void;
}

// ============================================================================
// Room Naming Conventions
// ============================================================================

/**
 * Generate room name for an analysis session.
 */
export function getAnalysisRoomName(analysisId: string): string {
  return `analysis:${analysisId}`;
}

/**
 * Parse analysis ID from room name.
 */
export function parseAnalysisRoomName(roomName: string): string | null {
  if (roomName.startsWith('analysis:')) {
    return roomName.slice(9);
  }
  return null;
}
