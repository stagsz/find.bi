/**
 * useWebSocket hook for real-time collaboration updates.
 *
 * Provides a typed Socket.io client for real-time collaboration features:
 * - Connection management with JWT authentication
 * - Room joining/leaving for analysis collaboration
 * - Event listeners for entry updates, conflicts, and user presence
 * - Reconnection handling with backoff
 *
 * @module hooks/useWebSocket
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

// ============================================================================
// Types (mirroring server-side socket.types.ts)
// ============================================================================

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

/**
 * Socket error response.
 */
export interface SocketError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

// ============================================================================
// Event Maps (typed Socket.io interfaces)
// ============================================================================

/**
 * Events emitted by the client to the server.
 */
interface ClientToServerEvents {
  'room:join': (
    payload: { analysisId: string },
    callback: (error?: SocketError) => void
  ) => void;
  'room:leave': (
    payload: { analysisId: string },
    callback: (error?: SocketError) => void
  ) => void;
  'cursor:update': (payload: { position: CursorPosition }) => void;
  ping: (callback: () => void) => void;
}

/**
 * Events emitted by the server to clients.
 */
interface ServerToClientEvents {
  'user:joined': (user: UserPresence) => void;
  'user:left': (userId: string) => void;
  'cursor:moved': (data: { userId: string; position: CursorPosition }) => void;
  'room:users': (users: UserPresence[]) => void;
  'entry:updated': (payload: EntryUpdatePayload) => void;
  'entry:created': (payload: EntryCreatedPayload) => void;
  'entry:deleted': (payload: EntryDeletedPayload) => void;
  'risk:updated': (payload: RiskUpdatePayload) => void;
  'entry:conflict': (payload: ConflictDetectedPayload) => void;
  'entry:conflict-resolved': (payload: ConflictResolvedPayload) => void;
  error: (error: SocketError) => void;
  pong: () => void;
}

/**
 * Typed Socket.io client type.
 */
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ============================================================================
// Connection State
// ============================================================================

/**
 * WebSocket connection status.
 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * State returned by the useWebSocket hook.
 */
export interface WebSocketState {
  /** Current connection status */
  status: ConnectionStatus;
  /** Whether connected and ready */
  isConnected: boolean;
  /** Current analysis room (if joined) */
  currentRoom: string | null;
  /** Users currently in the room */
  roomUsers: UserPresence[];
  /** Last error that occurred */
  lastError: SocketError | null;
  /** Pending conflict requiring resolution */
  pendingConflict: ConflictDetectedPayload | null;
}

/**
 * Actions returned by the useWebSocket hook.
 */
export interface WebSocketActions {
  /** Connect to the WebSocket server */
  connect: () => void;
  /** Disconnect from the WebSocket server */
  disconnect: () => void;
  /** Join an analysis collaboration room */
  joinRoom: (analysisId: string) => Promise<void>;
  /** Leave the current analysis room */
  leaveRoom: () => Promise<void>;
  /** Update cursor position in the room */
  updateCursor: (position: CursorPosition) => void;
  /** Clear the pending conflict */
  clearConflict: () => void;
}

/**
 * Event handlers for WebSocket events.
 */
export interface WebSocketEventHandlers {
  /** Called when an entry is created by another user */
  onEntryCreated?: (payload: EntryCreatedPayload) => void;
  /** Called when an entry is updated by another user */
  onEntryUpdated?: (payload: EntryUpdatePayload) => void;
  /** Called when an entry is deleted by another user */
  onEntryDeleted?: (payload: EntryDeletedPayload) => void;
  /** Called when risk is updated by another user */
  onRiskUpdated?: (payload: RiskUpdatePayload) => void;
  /** Called when a conflict is detected */
  onConflictDetected?: (payload: ConflictDetectedPayload) => void;
  /** Called when a conflict is resolved */
  onConflictResolved?: (payload: ConflictResolvedPayload) => void;
  /** Called when a user joins the room */
  onUserJoined?: (user: UserPresence) => void;
  /** Called when a user leaves the room */
  onUserLeft?: (userId: string) => void;
  /** Called when a user's cursor moves */
  onCursorMoved?: (data: { userId: string; position: CursorPosition }) => void;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * WebSocket server URL from environment or default.
 */
const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Reconnection configuration.
 */
const RECONNECT_CONFIG = {
  /** Maximum number of reconnection attempts */
  maxAttempts: 5,
  /** Initial delay between attempts (ms) */
  initialDelay: 1000,
  /** Maximum delay between attempts (ms) */
  maxDelay: 30000,
  /** Delay multiplier for exponential backoff */
  multiplier: 2,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing WebSocket connections for real-time collaboration.
 *
 * @param handlers - Optional event handlers for WebSocket events
 * @returns WebSocket state and actions
 *
 * @example
 * ```tsx
 * const { state, actions } = useWebSocket({
 *   onEntryUpdated: (payload) => {
 *     // Update local state with changes from other users
 *     updateEntry(payload.entryId, payload.changes);
 *   },
 *   onConflictDetected: (payload) => {
 *     // Show conflict resolution modal
 *     setShowConflictModal(true);
 *   },
 * });
 *
 * // Join a room when viewing an analysis
 * useEffect(() => {
 *   if (analysisId && state.isConnected) {
 *     actions.joinRoom(analysisId);
 *   }
 *   return () => {
 *     if (state.currentRoom) {
 *       actions.leaveRoom();
 *     }
 *   };
 * }, [analysisId, state.isConnected]);
 * ```
 */
export function useWebSocket(handlers: WebSocketEventHandlers = {}): {
  state: WebSocketState;
  actions: WebSocketActions;
} {
  // Refs for socket and handlers to avoid stale closures
  const socketRef = useRef<TypedSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [roomUsers, setRoomUsers] = useState<UserPresence[]>([]);
  const [lastError, setLastError] = useState<SocketError | null>(null);
  const [pendingConflict, setPendingConflict] = useState<ConflictDetectedPayload | null>(null);

  // Get auth token
  const getAccessToken = useAuthStore((state) => state.getAccessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  /**
   * Connect to the WebSocket server.
   */
  const connect = useCallback(() => {
    // Don't connect if not authenticated
    if (!isAuthenticated) {
      setLastError({ code: 'AUTHENTICATION_REQUIRED', message: 'Must be authenticated to connect' });
      return;
    }

    // Don't reconnect if already connected/connecting
    if (socketRef.current?.connected || status === 'connecting') {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setLastError({ code: 'AUTHENTICATION_REQUIRED', message: 'No access token available' });
      return;
    }

    setStatus('connecting');
    setLastError(null);

    // Create socket with auth token
    const socket: TypedSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_CONFIG.maxAttempts,
      reconnectionDelay: RECONNECT_CONFIG.initialDelay,
      reconnectionDelayMax: RECONNECT_CONFIG.maxDelay,
      timeout: 10000,
    });

    // Connection events
    socket.on('connect', () => {
      setStatus('connected');
      setLastError(null);
    });

    socket.on('disconnect', (reason) => {
      setStatus('disconnected');
      setCurrentRoom(null);
      setRoomUsers([]);

      // If server disconnected us, it might be auth issue
      if (reason === 'io server disconnect') {
        setLastError({ code: 'UNAUTHORIZED', message: 'Server disconnected the connection' });
      }
    });

    socket.io.on('reconnect_attempt', () => {
      setStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setStatus('connected');
      setLastError(null);
    });

    socket.io.on('reconnect_failed', () => {
      setStatus('error');
      setLastError({ code: 'INTERNAL_ERROR', message: 'Failed to reconnect after multiple attempts' });
    });

    socket.on('connect_error', (error) => {
      setStatus('error');
      setLastError({
        code: 'INTERNAL_ERROR',
        message: error.message || 'Connection failed',
      });
    });

    // Server error event
    socket.on('error', (error) => {
      setLastError(error);
    });

    // Room events
    socket.on('room:users', (users) => {
      setRoomUsers(users);
    });

    socket.on('user:joined', (user) => {
      setRoomUsers((prev) => {
        // Avoid duplicates
        if (prev.some((u) => u.userId === user.userId)) {
          return prev.map((u) => (u.userId === user.userId ? user : u));
        }
        return [...prev, user];
      });
      handlersRef.current.onUserJoined?.(user);
    });

    socket.on('user:left', (userId) => {
      setRoomUsers((prev) => prev.filter((u) => u.userId !== userId));
      handlersRef.current.onUserLeft?.(userId);
    });

    socket.on('cursor:moved', (data) => {
      setRoomUsers((prev) =>
        prev.map((u) =>
          u.userId === data.userId ? { ...u, cursor: data.position } : u
        )
      );
      handlersRef.current.onCursorMoved?.(data);
    });

    // Entry events
    socket.on('entry:created', (payload) => {
      handlersRef.current.onEntryCreated?.(payload);
    });

    socket.on('entry:updated', (payload) => {
      handlersRef.current.onEntryUpdated?.(payload);
    });

    socket.on('entry:deleted', (payload) => {
      handlersRef.current.onEntryDeleted?.(payload);
    });

    socket.on('risk:updated', (payload) => {
      handlersRef.current.onRiskUpdated?.(payload);
    });

    // Conflict events
    socket.on('entry:conflict', (payload) => {
      setPendingConflict(payload);
      handlersRef.current.onConflictDetected?.(payload);
    });

    socket.on('entry:conflict-resolved', (payload) => {
      setPendingConflict(null);
      handlersRef.current.onConflictResolved?.(payload);
    });

    socketRef.current = socket;
  }, [isAuthenticated, getAccessToken, status]);

  /**
   * Disconnect from the WebSocket server.
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus('disconnected');
    setCurrentRoom(null);
    setRoomUsers([]);
    setLastError(null);
    setPendingConflict(null);
  }, []);

  /**
   * Join an analysis collaboration room.
   */
  const joinRoom = useCallback(async (analysisId: string): Promise<void> => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new Error('Not connected to WebSocket server');
    }

    // Leave current room first if in one
    if (currentRoom && currentRoom !== analysisId) {
      await new Promise<void>((resolve) => {
        socket.emit('room:leave', { analysisId: currentRoom }, () => resolve());
      });
    }

    return new Promise((resolve, reject) => {
      socket.emit('room:join', { analysisId }, (error) => {
        if (error) {
          setLastError(error);
          reject(new Error(error.message));
        } else {
          setCurrentRoom(analysisId);
          setLastError(null);
          resolve();
        }
      });
    });
  }, [currentRoom]);

  /**
   * Leave the current analysis room.
   */
  const leaveRoom = useCallback(async (): Promise<void> => {
    const socket = socketRef.current;
    if (!socket?.connected || !currentRoom) {
      return;
    }

    return new Promise((resolve) => {
      socket.emit('room:leave', { analysisId: currentRoom }, () => {
        setCurrentRoom(null);
        setRoomUsers([]);
        resolve();
      });
    });
  }, [currentRoom]);

  /**
   * Update cursor position in the room.
   */
  const updateCursor = useCallback((position: CursorPosition) => {
    const socket = socketRef.current;
    if (socket?.connected && currentRoom) {
      socket.emit('cursor:update', { position });
    }
  }, [currentRoom]);

  /**
   * Clear the pending conflict.
   */
  const clearConflict = useCallback(() => {
    setPendingConflict(null);
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && status === 'disconnected') {
      connect();
    }
  }, [isAuthenticated, status, connect]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated && socketRef.current) {
      disconnect();
    }
  }, [isAuthenticated, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    state: {
      status,
      isConnected: status === 'connected',
      currentRoom,
      roomUsers,
      lastError,
      pendingConflict,
    },
    actions: {
      connect,
      disconnect,
      joinRoom,
      leaveRoom,
      updateCursor,
      clearConflict,
    },
  };
}

/**
 * Get the room name for an analysis.
 * Utility function matching server-side convention.
 */
export function getAnalysisRoomName(analysisId: string): string {
  return `analysis:${analysisId}`;
}
