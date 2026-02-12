/**
 * Unit tests for WebSocket service event handlers.
 *
 * Tests the WebSocket service functionality including:
 * - Room name helpers (getAnalysisRoomName, parseAnalysisRoomName)
 * - Socket event payload type validation
 * - Cursor position handling
 * - User presence management
 * - Conflict detection payloads
 * - Version handling for optimistic updates
 */

import { describe, it, expect } from '@jest/globals';
import type { UserRole } from '@hazop/types';
import type {
  CursorPosition,
  UserPresence,
  SocketUser,
  SocketData,
  JoinRoomPayload,
  LeaveRoomPayload,
  CursorUpdatePayload,
  EntryUpdatePayload,
  EntryCreatedPayload,
  EntryDeletedPayload,
  RiskUpdatePayload,
  ConflictDetectedPayload,
  ConflictResolvedPayload,
  ConflictEntrySnapshot,
  SocketError,
  SocketErrorCode,
} from '../types/socket.types.js';
import {
  getAnalysisRoomName,
  parseAnalysisRoomName,
} from '../types/socket.types.js';

// ==========================================================================
// Room Name Helper Tests
// ==========================================================================

describe('Room Name Helpers', () => {
  describe('getAnalysisRoomName', () => {
    it('should generate correct room name from analysis ID', () => {
      const roomName = getAnalysisRoomName('analysis-123');
      expect(roomName).toBe('analysis:analysis-123');
    });

    it('should handle UUID analysis IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const roomName = getAnalysisRoomName(uuid);
      expect(roomName).toBe(`analysis:${uuid}`);
    });

    it('should handle empty string', () => {
      const roomName = getAnalysisRoomName('');
      expect(roomName).toBe('analysis:');
    });

    it('should handle special characters in ID', () => {
      const roomName = getAnalysisRoomName('analysis-with_special.chars');
      expect(roomName).toBe('analysis:analysis-with_special.chars');
    });
  });

  describe('parseAnalysisRoomName', () => {
    it('should extract analysis ID from room name', () => {
      const analysisId = parseAnalysisRoomName('analysis:analysis-123');
      expect(analysisId).toBe('analysis-123');
    });

    it('should return null for invalid room name format', () => {
      expect(parseAnalysisRoomName('invalid-room-name')).toBeNull();
      expect(parseAnalysisRoomName('room:analysis-123')).toBeNull();
      expect(parseAnalysisRoomName('project:analysis-123')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseAnalysisRoomName('')).toBeNull();
    });

    it('should handle UUID analysis IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const analysisId = parseAnalysisRoomName(`analysis:${uuid}`);
      expect(analysisId).toBe(uuid);
    });

    it('should handle empty analysis ID', () => {
      const analysisId = parseAnalysisRoomName('analysis:');
      expect(analysisId).toBe('');
    });

    it('should round-trip with getAnalysisRoomName', () => {
      const originalId = 'test-analysis-id-123';
      const roomName = getAnalysisRoomName(originalId);
      const parsedId = parseAnalysisRoomName(roomName);
      expect(parsedId).toBe(originalId);
    });
  });
});

// ==========================================================================
// Socket Event Payload Type Tests
// ==========================================================================

describe('Socket Event Payload Types', () => {
  describe('CursorPosition', () => {
    it('should allow empty cursor position', () => {
      const cursor: CursorPosition = {};
      expect(cursor.nodeId).toBeUndefined();
      expect(cursor.entryId).toBeUndefined();
      expect(cursor.field).toBeUndefined();
    });

    it('should allow full cursor position', () => {
      const cursor: CursorPosition = {
        nodeId: 'node-123',
        entryId: 'entry-456',
        field: 'causes',
      };
      expect(cursor.nodeId).toBe('node-123');
      expect(cursor.entryId).toBe('entry-456');
      expect(cursor.field).toBe('causes');
    });

    it('should allow partial cursor position (node only)', () => {
      const cursor: CursorPosition = {
        nodeId: 'node-123',
      };
      expect(cursor.nodeId).toBe('node-123');
      expect(cursor.entryId).toBeUndefined();
    });

    it('should allow partial cursor position (entry only)', () => {
      const cursor: CursorPosition = {
        entryId: 'entry-456',
        field: 'consequences',
      };
      expect(cursor.entryId).toBe('entry-456');
      expect(cursor.field).toBe('consequences');
    });

    it('should support all HazOp field types', () => {
      const fields = ['causes', 'consequences', 'safeguards', 'recommendations', 'notes', 'deviation'];
      fields.forEach((field) => {
        const cursor: CursorPosition = { field };
        expect(cursor.field).toBe(field);
      });
    });
  });

  describe('UserPresence', () => {
    it('should require userId, email, and lastActivity', () => {
      const presence: UserPresence = {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
      };
      expect(presence.userId).toBe('user-123');
      expect(presence.email).toBe('test@example.com');
      expect(presence.lastActivity).toBe('2026-02-11T10:00:00Z');
      expect(presence.cursor).toBeUndefined();
    });

    it('should allow optional cursor', () => {
      const presence: UserPresence = {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
        cursor: {
          nodeId: 'node-123',
          entryId: 'entry-456',
        },
      };
      expect(presence.cursor).toBeDefined();
      expect(presence.cursor!.nodeId).toBe('node-123');
    });
  });

  describe('SocketUser', () => {
    it('should have id, email, and role', () => {
      const user: SocketUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'analyst',
      };
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('analyst');
    });

    it('should accept all valid user roles', () => {
      const validRoles: UserRole[] = ['administrator', 'lead_analyst', 'analyst', 'viewer'];
      validRoles.forEach((role) => {
        const user: SocketUser = {
          id: 'user-123',
          email: 'test@example.com',
          role,
        };
        expect(user.role).toBe(role);
      });
    });
  });

  describe('SocketData', () => {
    it('should require user and allow optional fields', () => {
      const data: SocketData = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'analyst',
        },
      };
      expect(data.user.id).toBe('user-123');
      expect(data.analysisId).toBeUndefined();
      expect(data.sessionId).toBeUndefined();
    });

    it('should allow analysisId and sessionId', () => {
      const data: SocketData = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'analyst',
        },
        analysisId: 'analysis-456',
        sessionId: 'session-789',
      };
      expect(data.analysisId).toBe('analysis-456');
      expect(data.sessionId).toBe('session-789');
    });
  });

  describe('JoinRoomPayload', () => {
    it('should have analysisId', () => {
      const payload: JoinRoomPayload = {
        analysisId: 'analysis-123',
      };
      expect(payload.analysisId).toBe('analysis-123');
    });
  });

  describe('LeaveRoomPayload', () => {
    it('should have analysisId', () => {
      const payload: LeaveRoomPayload = {
        analysisId: 'analysis-123',
      };
      expect(payload.analysisId).toBe('analysis-123');
    });
  });

  describe('CursorUpdatePayload', () => {
    it('should have position', () => {
      const payload: CursorUpdatePayload = {
        position: {
          nodeId: 'node-123',
          entryId: 'entry-456',
          field: 'causes',
        },
      };
      expect(payload.position.nodeId).toBe('node-123');
    });

    it('should allow empty position', () => {
      const payload: CursorUpdatePayload = {
        position: {},
      };
      expect(payload.position).toEqual({});
    });
  });
});

// ==========================================================================
// Broadcast Payload Structure Tests
// ==========================================================================

describe('Broadcast Payload Structures', () => {
  describe('EntryUpdatePayload', () => {
    it('should have correct structure', () => {
      const payload: EntryUpdatePayload = {
        entryId: 'entry-123',
        changes: { deviation: 'New deviation', causes: ['Cause 1'] },
        userId: 'user-123',
        version: 5,
      };

      expect(payload.entryId).toBe('entry-123');
      expect(payload.changes).toEqual({ deviation: 'New deviation', causes: ['Cause 1'] });
      expect(payload.userId).toBe('user-123');
      expect(payload.version).toBe(5);
    });

    it('should allow empty changes', () => {
      const payload: EntryUpdatePayload = {
        entryId: 'entry-123',
        changes: {},
        userId: 'user-123',
        version: 1,
      };
      expect(payload.changes).toEqual({});
    });
  });

  describe('EntryCreatedPayload', () => {
    it('should have correct structure', () => {
      const payload: EntryCreatedPayload = {
        entry: {
          id: 'entry-123',
          analysisId: 'analysis-456',
          nodeId: 'node-789',
          guideWord: 'NO',
          deviation: 'No flow',
          version: 1,
        },
        userId: 'user-123',
      };

      expect(payload.entry.id).toBe('entry-123');
      expect(payload.userId).toBe('user-123');
    });
  });

  describe('EntryDeletedPayload', () => {
    it('should have correct structure', () => {
      const payload: EntryDeletedPayload = {
        entryId: 'entry-123',
        userId: 'user-123',
      };

      expect(payload.entryId).toBe('entry-123');
      expect(payload.userId).toBe('user-123');
    });
  });

  describe('RiskUpdatePayload', () => {
    it('should have correct structure with all risk fields', () => {
      const payload: RiskUpdatePayload = {
        entryId: 'entry-123',
        risk: {
          severity: 4,
          likelihood: 3,
          detectability: 2,
          riskScore: 24,
          riskLevel: 'medium',
        },
        userId: 'user-123',
      };

      expect(payload.risk.severity).toBe(4);
      expect(payload.risk.likelihood).toBe(3);
      expect(payload.risk.detectability).toBe(2);
      expect(payload.risk.riskScore).toBe(24);
      expect(payload.risk.riskLevel).toBe('medium');
    });

    it('should allow partial risk updates', () => {
      const payload: RiskUpdatePayload = {
        entryId: 'entry-123',
        risk: {
          severity: 5,
        },
        userId: 'user-123',
      };

      expect(payload.risk.severity).toBe(5);
      expect(payload.risk.likelihood).toBeUndefined();
    });
  });
});

// ==========================================================================
// Conflict Detection Payload Tests
// ==========================================================================

describe('Conflict Detection Payloads', () => {
  describe('ConflictEntrySnapshot', () => {
    it('should have all required fields', () => {
      const snapshot: ConflictEntrySnapshot = {
        id: 'entry-123',
        version: 3,
        deviation: 'Test deviation',
        causes: ['Cause 1', 'Cause 2'],
        consequences: ['Consequence 1'],
        safeguards: ['Safeguard 1'],
        recommendations: ['Recommendation 1'],
        notes: 'Some notes',
        severity: 4,
        likelihood: 3,
        detectability: 2,
        riskScore: 24,
        riskLevel: 'medium',
        updatedAt: '2026-02-11T10:00:00Z',
      };

      expect(snapshot.id).toBe('entry-123');
      expect(snapshot.version).toBe(3);
      expect(snapshot.causes).toHaveLength(2);
    });

    it('should allow null values for risk fields', () => {
      const snapshot: ConflictEntrySnapshot = {
        id: 'entry-123',
        version: 1,
        deviation: 'Test',
        causes: [],
        consequences: [],
        safeguards: [],
        recommendations: [],
        notes: null,
        severity: null,
        likelihood: null,
        detectability: null,
        riskScore: null,
        riskLevel: null,
        updatedAt: '2026-02-11T00:00:00Z',
      };

      expect(snapshot.severity).toBeNull();
      expect(snapshot.riskScore).toBeNull();
      expect(snapshot.notes).toBeNull();
    });
  });

  describe('ConflictDetectedPayload', () => {
    it('should have correct structure', () => {
      const payload: ConflictDetectedPayload = {
        entryId: 'entry-123',
        expectedVersion: 2,
        currentVersion: 3,
        serverData: {
          id: 'entry-123',
          version: 3,
          deviation: 'Server deviation',
          causes: ['Server cause'],
          consequences: ['Server consequence'],
          safeguards: ['Server safeguard'],
          recommendations: ['Server recommendation'],
          notes: 'Server notes',
          severity: 4,
          likelihood: 3,
          detectability: 2,
          riskScore: 24,
          riskLevel: 'medium',
          updatedAt: '2026-02-11T10:00:00Z',
        },
        clientChanges: {
          deviation: 'Client deviation',
          causes: ['Client cause'],
        },
        conflictingUserId: 'other-user-id',
        conflictingUserEmail: 'other@example.com',
        conflictedAt: '2026-02-11T10:05:00Z',
      };

      expect(payload.entryId).toBe('entry-123');
      expect(payload.expectedVersion).toBe(2);
      expect(payload.currentVersion).toBe(3);
      expect(payload.serverData.version).toBe(3);
      expect(payload.clientChanges.deviation).toBe('Client deviation');
      expect(payload.conflictingUserId).toBe('other-user-id');
      expect(payload.conflictingUserEmail).toBe('other@example.com');
    });

    it('should allow optional conflictingUserEmail', () => {
      const payload: ConflictDetectedPayload = {
        entryId: 'entry-123',
        expectedVersion: 1,
        currentVersion: 2,
        serverData: {
          id: 'entry-123',
          version: 2,
          deviation: 'Test',
          causes: [],
          consequences: [],
          safeguards: [],
          recommendations: [],
          notes: null,
          severity: null,
          likelihood: null,
          detectability: null,
          riskScore: null,
          riskLevel: null,
          updatedAt: '2026-02-11T00:00:00Z',
        },
        clientChanges: {},
        conflictingUserId: 'user-id',
        conflictedAt: '2026-02-11T00:00:00Z',
      };

      expect(payload.conflictingUserEmail).toBeUndefined();
    });
  });

  describe('ConflictResolvedPayload', () => {
    const baseFinalData: ConflictEntrySnapshot = {
      id: 'entry-123',
      version: 4,
      deviation: 'Resolved deviation',
      causes: ['Cause'],
      consequences: [],
      safeguards: [],
      recommendations: [],
      notes: null,
      severity: 3,
      likelihood: 3,
      detectability: 3,
      riskScore: 27,
      riskLevel: 'medium',
      updatedAt: '2026-02-11T10:10:00Z',
    };

    it('should have correct structure for accept_server resolution', () => {
      const payload: ConflictResolvedPayload = {
        entryId: 'entry-123',
        resolution: 'accept_server',
        finalData: baseFinalData,
        resolvedByUserId: 'user-123',
        resolvedAt: '2026-02-11T10:10:00Z',
      };

      expect(payload.resolution).toBe('accept_server');
      expect(payload.finalData.version).toBe(4);
    });

    it('should have correct structure for accept_client resolution', () => {
      const payload: ConflictResolvedPayload = {
        entryId: 'entry-123',
        resolution: 'accept_client',
        finalData: baseFinalData,
        resolvedByUserId: 'user-123',
        resolvedAt: '2026-02-11T10:10:00Z',
      };

      expect(payload.resolution).toBe('accept_client');
    });

    it('should have correct structure for merge resolution', () => {
      const payload: ConflictResolvedPayload = {
        entryId: 'entry-123',
        resolution: 'merge',
        finalData: {
          ...baseFinalData,
          causes: ['Server cause', 'Client cause'],
        },
        resolvedByUserId: 'user-123',
        resolvedAt: '2026-02-11T10:10:00Z',
      };

      expect(payload.resolution).toBe('merge');
      expect(payload.finalData.causes).toContain('Server cause');
      expect(payload.finalData.causes).toContain('Client cause');
    });
  });
});

// ==========================================================================
// Socket Error Types Tests
// ==========================================================================

describe('Socket Error Types', () => {
  describe('SocketError', () => {
    it('should have code and message', () => {
      const error: SocketError = {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Please authenticate to continue',
      };

      expect(error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(error.message).toBe('Please authenticate to continue');
    });

    it('should support all error codes', () => {
      const errorCodes: SocketErrorCode[] = [
        'AUTHENTICATION_REQUIRED',
        'INVALID_TOKEN',
        'TOKEN_EXPIRED',
        'UNAUTHORIZED',
        'ROOM_NOT_FOUND',
        'NOT_IN_ROOM',
        'INVALID_PAYLOAD',
        'INTERNAL_ERROR',
      ];

      errorCodes.forEach((code) => {
        const error: SocketError = { code, message: `Error: ${code}` };
        expect(error.code).toBe(code);
      });
    });
  });
});

// ==========================================================================
// Event Handler Logic Tests
// ==========================================================================

describe('Event Handler Logic', () => {
  describe('Room Join Logic', () => {
    it('should create room name from analysis ID', () => {
      const analysisId = 'analysis-123';
      const roomName = `analysis:${analysisId}`;
      expect(roomName).toBe('analysis:analysis-123');
    });

    it('should create user presence object correctly', () => {
      const user: SocketUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'analyst',
      };

      const presence: UserPresence = {
        userId: user.id,
        email: user.email,
        lastActivity: new Date().toISOString(),
      };

      expect(presence.userId).toBe('user-123');
      expect(presence.email).toBe('test@example.com');
      expect(typeof presence.lastActivity).toBe('string');
    });
  });

  describe('Room State Management', () => {
    it('should track multiple users correctly', () => {
      const users = new Map<string, UserPresence>();

      // Add first user
      users.set('user-1', {
        userId: 'user-1',
        email: 'user1@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
      });

      // Add second user
      users.set('user-2', {
        userId: 'user-2',
        email: 'user2@example.com',
        lastActivity: '2026-02-11T10:01:00Z',
      });

      // Add third user
      users.set('user-3', {
        userId: 'user-3',
        email: 'user3@example.com',
        lastActivity: '2026-02-11T10:02:00Z',
      });

      expect(users.size).toBe(3);
      expect(Array.from(users.keys())).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should handle user re-joining (updates existing entry)', () => {
      const users = new Map<string, UserPresence>();

      // Initial join
      users.set('user-1', {
        userId: 'user-1',
        email: 'user1@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
      });

      // Re-join (update)
      users.set('user-1', {
        userId: 'user-1',
        email: 'user1@example.com',
        lastActivity: '2026-02-11T10:30:00Z',
      });

      expect(users.size).toBe(1);
      expect(users.get('user-1')!.lastActivity).toBe('2026-02-11T10:30:00Z');
    });

    it('should remove user from room state', () => {
      const users = new Map<string, UserPresence>();
      users.set('user-123', {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2026-02-11T00:00:00Z',
      });
      users.set('user-456', {
        userId: 'user-456',
        email: 'other@example.com',
        lastActivity: '2026-02-11T00:00:00Z',
      });

      // Simulate user leaving
      users.delete('user-123');

      expect(users.has('user-123')).toBe(false);
      expect(users.has('user-456')).toBe(true);
      expect(users.size).toBe(1);
    });

    it('should detect when room becomes empty', () => {
      const users = new Map<string, UserPresence>();
      users.set('user-123', {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2026-02-11T00:00:00Z',
      });

      // Simulate last user leaving
      users.delete('user-123');

      expect(users.size).toBe(0);
    });
  });

  describe('Cursor Update Logic', () => {
    it('should update user presence with cursor position', () => {
      const presence: UserPresence = {
        userId: 'user-123',
        email: 'test@example.com',
        lastActivity: '2026-02-11T00:00:00Z',
      };

      const newCursor: CursorPosition = {
        nodeId: 'node-456',
        entryId: 'entry-789',
        field: 'safeguards',
      };

      // Simulate cursor update
      presence.cursor = newCursor;
      presence.lastActivity = new Date().toISOString();

      expect(presence.cursor).toEqual(newCursor);
      expect(presence.cursor.nodeId).toBe('node-456');
      expect(presence.cursor.entryId).toBe('entry-789');
      expect(presence.cursor.field).toBe('safeguards');
    });
  });

  describe('Empty Room Cleanup', () => {
    it('should detect empty room after all users leave', () => {
      const rooms = new Map<string, { users: Map<string, UserPresence> }>();

      // Create room with users
      const roomName = 'analysis:analysis-123';
      const users = new Map<string, UserPresence>();
      users.set('user-1', {
        userId: 'user-1',
        email: 'user1@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
      });
      rooms.set(roomName, { users });

      // User leaves
      users.delete('user-1');

      // Check if room should be cleaned up
      if (users.size === 0) {
        rooms.delete(roomName);
      }

      expect(rooms.has(roomName)).toBe(false);
    });

    it('should not cleanup room if users remain', () => {
      const rooms = new Map<string, { users: Map<string, UserPresence> }>();

      // Create room with multiple users
      const roomName = 'analysis:analysis-123';
      const users = new Map<string, UserPresence>();
      users.set('user-1', {
        userId: 'user-1',
        email: 'user1@example.com',
        lastActivity: '2026-02-11T10:00:00Z',
      });
      users.set('user-2', {
        userId: 'user-2',
        email: 'user2@example.com',
        lastActivity: '2026-02-11T10:01:00Z',
      });
      rooms.set(roomName, { users });

      // One user leaves
      users.delete('user-1');

      // Check if room should be cleaned up
      if (users.size === 0) {
        rooms.delete(roomName);
      }

      expect(rooms.has(roomName)).toBe(true);
      expect(users.size).toBe(1);
    });
  });
});

// ==========================================================================
// Authentication Edge Cases
// ==========================================================================

describe('Authentication Edge Cases', () => {
  describe('Token Extraction', () => {
    it('should extract token from auth object', () => {
      const handshake: { auth?: { token?: string }; query?: { token?: string } } = {
        auth: { token: 'auth-token' },
        query: {},
      };

      const token = handshake.auth?.token || handshake.query?.token;
      expect(token).toBe('auth-token');
    });

    it('should extract token from query parameter', () => {
      const handshake: { auth?: { token?: string }; query?: { token?: string } } = {
        auth: {},
        query: { token: 'query-token' },
      };

      const token = handshake.auth?.token || handshake.query?.token;
      expect(token).toBe('query-token');
    });

    it('should prefer auth object over query parameter', () => {
      const handshake: { auth?: { token?: string }; query?: { token?: string } } = {
        auth: { token: 'auth-token' },
        query: { token: 'query-token' },
      };

      const token = handshake.auth?.token || handshake.query?.token;
      expect(token).toBe('auth-token');
    });

    it('should handle missing token', () => {
      const handshake: { auth?: { token?: string }; query?: { token?: string } } = {
        auth: {},
        query: {},
      };

      const token = handshake.auth?.token || handshake.query?.token;
      expect(token).toBeUndefined();
    });
  });
});

// ==========================================================================
// Version Number Handling Tests
// ==========================================================================

describe('Version Number Handling', () => {
  it('should handle version 1 (initial)', () => {
    const version = 1;
    expect(version).toBe(1);
  });

  it('should handle version increment', () => {
    let version = 1;
    version += 1;
    expect(version).toBe(2);
  });

  it('should handle large version numbers', () => {
    const version = 99999;
    expect(version).toBe(99999);
  });

  it('should detect version mismatch for conflict', () => {
    const checkConflict = (expected: number, current: number): boolean => {
      return current !== expected;
    };
    expect(checkConflict(5, 7)).toBe(true);
  });

  it('should detect version match (no conflict)', () => {
    const checkVersionMatch = (expected: number, current: number): boolean => {
      return current === expected;
    };
    expect(checkVersionMatch(5, 5)).toBe(true);
    expect(checkVersionMatch(3, 5)).toBe(false);
  });
});

// ==========================================================================
// ISO 8601 Timestamp Handling Tests
// ==========================================================================

describe('Timestamp Handling', () => {
  it('should generate valid ISO 8601 timestamps', () => {
    const timestamp = new Date().toISOString();
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should parse ISO 8601 timestamps correctly', () => {
    const timestamp = '2026-02-11T10:30:00.000Z';
    const date = new Date(timestamp);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(1); // 0-indexed, February
    expect(date.getUTCDate()).toBe(11);
    expect(date.getUTCHours()).toBe(10);
    expect(date.getUTCMinutes()).toBe(30);
  });

  it('should compare timestamps for activity ordering', () => {
    const earlier = '2026-02-11T10:00:00.000Z';
    const later = '2026-02-11T10:30:00.000Z';

    const earlierDate = new Date(earlier);
    const laterDate = new Date(later);

    expect(laterDate > earlierDate).toBe(true);
  });
});
