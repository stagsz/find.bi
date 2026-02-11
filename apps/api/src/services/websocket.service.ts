/**
 * WebSocket service for real-time collaboration.
 *
 * Provides Socket.io server initialization with JWT authentication,
 * room management, and event handling for collaborative HazOps analysis.
 * Integrates with collaboration service for database-backed session persistence.
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { getJwtService } from './jwt.service.js';
import { loadSocketConfig } from '../config/socket.config.js';
import * as collaborationService from './collaboration.service.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketUser,
  SocketError,
  UserPresence,
  CursorPosition,
  getAnalysisRoomName,
} from '../types/socket.types.js';

// Re-export room helpers
export { getAnalysisRoomName, parseAnalysisRoomName } from '../types/socket.types.js';

/**
 * Typed Socket.io Server instance.
 */
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Typed Socket instance.
 */
export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Room state for tracking connected users.
 */
interface RoomState {
  /** Users currently in the room */
  users: Map<string, UserPresence>;
  /** Database session ID for persistence */
  sessionId?: string;
}

/**
 * WebSocket service class managing Socket.io server.
 */
export class WebSocketService {
  private io: TypedServer | null = null;
  private rooms: Map<string, RoomState> = new Map();

  /**
   * Initialize the WebSocket server.
   *
   * @param httpServer - The HTTP server to attach Socket.io to
   * @returns The configured Socket.io server instance
   */
  async initialize(httpServer: HttpServer): Promise<TypedServer> {
    if (this.io) {
      return this.io;
    }

    const config = loadSocketConfig();

    // Create Socket.io server with typed events
    this.io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(httpServer, {
      cors: config.cors,
      pingTimeout: config.pingTimeout,
      pingInterval: config.pingInterval,
      maxHttpBufferSize: config.maxHttpBufferSize,
      connectTimeout: config.connectTimeout,
      allowUpgrades: config.allowUpgrades,
      transports: config.transports,
    });

    // Apply authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const user = await this.authenticateSocket(socket);
        socket.data.user = user;
        next();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        next(new Error(message));
      }
    });

    // Set up connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('WebSocket server initialized');
    return this.io;
  }

  /**
   * Authenticate socket connection using JWT from handshake.
   *
   * Token can be provided via:
   * - query parameter: ?token=<jwt>
   * - auth object: { token: <jwt> }
   *
   * @param socket - The socket attempting to connect
   * @returns Authenticated user data
   * @throws Error if authentication fails
   */
  private async authenticateSocket(socket: TypedSocket): Promise<SocketUser> {
    // Extract token from handshake
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);

    if (!token) {
      throw new Error('No authentication token provided');
    }

    // Verify the token using JWT service
    const jwtService = getJwtService();
    await jwtService.initialize();

    const result = await jwtService.verifyAccessToken(token);

    if (!result.valid) {
      throw new Error(result.error);
    }

    // Return user data from token
    return {
      id: result.payload.sub,
      email: result.payload.email,
      role: result.payload.role,
    };
  }

  /**
   * Handle new socket connection.
   *
   * @param socket - The connected socket
   */
  private handleConnection(socket: TypedSocket): void {
    const user = socket.data.user;
    console.log(`User connected: ${user.email} (${socket.id})`);

    // Handle room join
    socket.on('room:join', async (payload, callback) => {
      try {
        await this.handleJoinRoom(socket, payload.analysisId);
        callback();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to join room';
        callback({ code: 'INTERNAL_ERROR', message });
      }
    });

    // Handle room leave
    socket.on('room:leave', async (payload, callback) => {
      try {
        await this.handleLeaveRoom(socket, payload.analysisId);
        callback();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to leave room';
        callback({ code: 'INTERNAL_ERROR', message });
      }
    });

    // Handle cursor updates
    socket.on('cursor:update', (payload) => {
      this.handleCursorUpdate(socket, payload.position);
    });

    // Handle ping (keep-alive)
    socket.on('ping', (callback) => {
      callback();
      socket.emit('pong');
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });
  }

  /**
   * Handle user joining a collaboration room.
   * Creates or joins a database-backed collaboration session.
   *
   * @param socket - The socket joining
   * @param analysisId - The analysis ID to join
   */
  private async handleJoinRoom(socket: TypedSocket, analysisId: string): Promise<void> {
    const user = socket.data.user;
    const roomName = `analysis:${analysisId}`;

    // Join the Socket.io room
    await socket.join(roomName);

    // Store room context on socket
    socket.data.analysisId = analysisId;

    // Initialize room state if needed
    let roomState = this.rooms.get(roomName);
    if (!roomState) {
      roomState = { users: new Map() };
      this.rooms.set(roomName, roomState);
    }

    // Get or create a database-backed collaboration session
    try {
      const session = await collaborationService.getOrCreateActiveSession(
        analysisId,
        user.id
      );
      roomState.sessionId = session.id;
      socket.data.sessionId = session.id;

      // Join the session in the database
      await collaborationService.joinSession(session.id, user.id);
    } catch (error) {
      // Database persistence failed - log but continue with in-memory room
      console.error('Failed to persist collaboration session:', error);
    }

    // Create user presence
    const presence: UserPresence = {
      userId: user.id,
      email: user.email,
      lastActivity: new Date().toISOString(),
    };

    // Add user to room state
    roomState.users.set(user.id, presence);

    // Send current room users to the joining user
    const usersArray = Array.from(roomState.users.values());
    socket.emit('room:users', usersArray);

    // Notify other users in the room
    socket.to(roomName).emit('user:joined', presence);

    console.log(`User ${user.email} joined room ${roomName}`);
  }

  /**
   * Handle user leaving a collaboration room.
   * Updates the database session participant record.
   *
   * @param socket - The socket leaving
   * @param analysisId - The analysis ID to leave
   */
  private async handleLeaveRoom(socket: TypedSocket, analysisId: string): Promise<void> {
    const user = socket.data.user;
    const roomName = `analysis:${analysisId}`;
    const sessionId = socket.data.sessionId;

    // Leave the Socket.io room
    await socket.leave(roomName);

    // Clear room context on socket
    socket.data.analysisId = undefined;
    socket.data.sessionId = undefined;

    // Update database session participant record
    if (sessionId) {
      try {
        await collaborationService.leaveSession(sessionId, user.id);
      } catch (error) {
        console.error('Failed to update session participant:', error);
      }
    }

    // Remove user from room state
    const roomState = this.rooms.get(roomName);
    if (roomState) {
      roomState.users.delete(user.id);

      // Clean up empty rooms and optionally end database session
      if (roomState.users.size === 0) {
        this.rooms.delete(roomName);
        // Don't auto-end the session - let it stay active for users to rejoin
      }
    }

    // Notify other users in the room
    socket.to(roomName).emit('user:left', user.id);

    console.log(`User ${user.email} left room ${roomName}`);
  }

  /**
   * Handle cursor position update from a user.
   * Updates both in-memory state and database record.
   *
   * @param socket - The socket sending the update
   * @param position - The new cursor position
   */
  private handleCursorUpdate(socket: TypedSocket, position: CursorPosition): void {
    const user = socket.data.user;
    const analysisId = socket.data.analysisId;
    const sessionId = socket.data.sessionId;

    if (!analysisId) {
      return;
    }

    const roomName = `analysis:${analysisId}`;
    const roomState = this.rooms.get(roomName);

    if (roomState) {
      // Update stored presence
      const presence = roomState.users.get(user.id);
      if (presence) {
        presence.cursor = position;
        presence.lastActivity = new Date().toISOString();
      }
    }

    // Update cursor position in database (fire and forget - don't await)
    if (sessionId) {
      collaborationService.updateParticipantCursor(sessionId, user.id, position).catch((error) => {
        console.error('Failed to update cursor in database:', error);
      });
    }

    // Broadcast cursor position to other users in the room
    socket.to(roomName).emit('cursor:moved', {
      userId: user.id,
      position,
    });
  }

  /**
   * Handle socket disconnect.
   * Updates the database session participant record.
   *
   * @param socket - The disconnected socket
   * @param reason - The disconnect reason
   */
  private handleDisconnect(socket: TypedSocket, reason: string): void {
    const user = socket.data.user;
    const analysisId = socket.data.analysisId;
    const sessionId = socket.data.sessionId;

    console.log(`User disconnected: ${user.email} (reason: ${reason})`);

    // Update database session participant record
    if (sessionId) {
      collaborationService.leaveSession(sessionId, user.id).catch((error) => {
        console.error('Failed to update session participant on disconnect:', error);
      });
    }

    if (analysisId) {
      const roomName = `analysis:${analysisId}`;
      const roomState = this.rooms.get(roomName);

      if (roomState) {
        roomState.users.delete(user.id);

        // Clean up empty rooms
        if (roomState.users.size === 0) {
          this.rooms.delete(roomName);
        } else {
          // Notify remaining users
          socket.to(roomName).emit('user:left', user.id);
        }
      }
    }
  }

  /**
   * Broadcast an entry update to all users in an analysis room.
   *
   * @param analysisId - The analysis ID
   * @param entryId - The entry ID that was updated
   * @param changes - The changes made
   * @param userId - The user who made the change
   * @param version - The new version number after the update
   */
  broadcastEntryUpdate(
    analysisId: string,
    entryId: string,
    changes: Record<string, unknown>,
    userId: string,
    version: number
  ): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('entry:updated', {
      entryId,
      changes,
      userId,
      version,
    });
  }

  /**
   * Broadcast a new entry creation to all users in an analysis room.
   *
   * @param analysisId - The analysis ID
   * @param entry - The created entry
   * @param userId - The user who created the entry
   */
  broadcastEntryCreated(
    analysisId: string,
    entry: Record<string, unknown>,
    userId: string
  ): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('entry:created', {
      entry,
      userId,
    });
  }

  /**
   * Broadcast an entry deletion to all users in an analysis room.
   *
   * @param analysisId - The analysis ID
   * @param entryId - The deleted entry ID
   * @param userId - The user who deleted the entry
   */
  broadcastEntryDeleted(analysisId: string, entryId: string, userId: string): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('entry:deleted', {
      entryId,
      userId,
    });
  }

  /**
   * Broadcast a risk update to all users in an analysis room.
   *
   * @param analysisId - The analysis ID
   * @param entryId - The entry ID with updated risk
   * @param risk - The updated risk data
   * @param userId - The user who made the change
   */
  broadcastRiskUpdate(
    analysisId: string,
    entryId: string,
    risk: {
      severity?: number;
      likelihood?: number;
      detectability?: number;
      riskScore?: number;
      riskLevel?: string;
    },
    userId: string
  ): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('risk:updated', {
      entryId,
      risk,
      userId,
    });
  }

  /**
   * Broadcast a conflict detection to a specific user in an analysis room.
   * This notifies the user who attempted the update that their changes conflict.
   *
   * @param analysisId - The analysis ID
   * @param conflictPayload - The conflict detection payload
   */
  broadcastConflictDetected(
    analysisId: string,
    conflictPayload: {
      entryId: string;
      expectedVersion: number;
      currentVersion: number;
      serverData: {
        id: string;
        version: number;
        deviation: string;
        causes: string[];
        consequences: string[];
        safeguards: string[];
        recommendations: string[];
        notes: string | null;
        severity: number | null;
        likelihood: number | null;
        detectability: number | null;
        riskScore: number | null;
        riskLevel: string | null;
        updatedAt: string;
      };
      clientChanges: Record<string, unknown>;
      conflictingUserId: string;
      conflictingUserEmail?: string;
      conflictedAt: string;
    }
  ): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('entry:conflict', conflictPayload);
  }

  /**
   * Broadcast a conflict resolution to all users in an analysis room.
   *
   * @param analysisId - The analysis ID
   * @param resolutionPayload - The conflict resolution payload
   */
  broadcastConflictResolved(
    analysisId: string,
    resolutionPayload: {
      entryId: string;
      resolution: 'accept_server' | 'accept_client' | 'merge';
      finalData: {
        id: string;
        version: number;
        deviation: string;
        causes: string[];
        consequences: string[];
        safeguards: string[];
        recommendations: string[];
        notes: string | null;
        severity: number | null;
        likelihood: number | null;
        detectability: number | null;
        riskScore: number | null;
        riskLevel: string | null;
        updatedAt: string;
      };
      resolvedByUserId: string;
      resolvedAt: string;
    }
  ): void {
    if (!this.io) return;

    const roomName = `analysis:${analysisId}`;
    this.io.to(roomName).emit('entry:conflict-resolved', resolutionPayload);
  }

  /**
   * Get the Socket.io server instance.
   *
   * @returns The Socket.io server or null if not initialized
   */
  getServer(): TypedServer | null {
    return this.io;
  }

  /**
   * Get users currently in a room.
   *
   * @param analysisId - The analysis ID
   * @returns Array of user presences or empty array
   */
  getRoomUsers(analysisId: string): UserPresence[] {
    const roomName = `analysis:${analysisId}`;
    const roomState = this.rooms.get(roomName);
    return roomState ? Array.from(roomState.users.values()) : [];
  }

  /**
   * Check if a room is active (has connected users).
   *
   * @param analysisId - The analysis ID
   * @returns True if the room has active users
   */
  isRoomActive(analysisId: string): boolean {
    const roomName = `analysis:${analysisId}`;
    const roomState = this.rooms.get(roomName);
    return roomState ? roomState.users.size > 0 : false;
  }

  /**
   * Get the collaboration session ID for an analysis room.
   *
   * @param analysisId - The analysis ID
   * @returns The session ID or undefined if not found
   */
  getRoomSessionId(analysisId: string): string | undefined {
    const roomName = `analysis:${analysisId}`;
    const roomState = this.rooms.get(roomName);
    return roomState?.sessionId;
  }

  /**
   * End a collaboration session explicitly.
   * This marks all participants as inactive and ends the session.
   *
   * @param analysisId - The analysis ID
   * @returns True if the session was ended
   */
  async endCollaborationSession(analysisId: string): Promise<boolean> {
    const roomName = `analysis:${analysisId}`;
    const roomState = this.rooms.get(roomName);

    if (!roomState?.sessionId) {
      return false;
    }

    try {
      // Mark all participants as inactive
      await collaborationService.markAllParticipantsInactive(roomState.sessionId);
      // End the session
      await collaborationService.endSession(roomState.sessionId);

      // Notify all users in the room that the session ended
      if (this.io) {
        this.io.to(roomName).emit('error', {
          code: 'INTERNAL_ERROR',
          message: 'Collaboration session ended',
        });
      }

      // Clean up room state
      this.rooms.delete(roomName);

      return true;
    } catch (error) {
      console.error('Failed to end collaboration session:', error);
      return false;
    }
  }

  /**
   * Close the WebSocket server.
   */
  async close(): Promise<void> {
    if (this.io) {
      await new Promise<void>((resolve) => {
        this.io!.close(() => {
          resolve();
        });
      });
      this.io = null;
      this.rooms.clear();
      console.log('WebSocket server closed');
    }
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

/**
 * Get the singleton WebSocket service instance.
 */
export function getWebSocketService(): WebSocketService {
  if (!webSocketService) {
    webSocketService = new WebSocketService();
  }
  return webSocketService;
}

/**
 * Create a new WebSocket service instance (for testing).
 */
export function createWebSocketService(): WebSocketService {
  return new WebSocketService();
}
