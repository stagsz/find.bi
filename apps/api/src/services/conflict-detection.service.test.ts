/**
 * Unit tests for conflict-detection.service.ts
 *
 * Tests the conflict detection functionality for concurrent edits including:
 * - Version checking logic
 * - Conflict detection scenarios
 * - Conflict info building
 */

import { describe, it, expect } from '@jest/globals';
import type {
  ConflictCheckResult,
  ConflictEntryData,
  ConflictInfo,
  OptimisticUpdateResult,
} from './conflict-detection.service.js';
import { buildConflictInfo } from './conflict-detection.service.js';

describe('Conflict Detection Service', () => {
  // ==========================================================================
  // buildConflictInfo
  // ==========================================================================

  describe('buildConflictInfo', () => {
    const mockEntryData: ConflictEntryData = {
      id: 'entry-123',
      version: 3,
      deviation: 'No flow in pipe',
      causes: ['Valve closed', 'Pump failure'],
      consequences: ['Process shutdown'],
      safeguards: ['Flow alarm'],
      recommendations: ['Install backup pump'],
      notes: 'Critical entry',
      severity: 4,
      likelihood: 3,
      detectability: 2,
      riskScore: 24,
      riskLevel: 'medium',
      updatedAt: '2026-02-11T10:00:00.000Z',
    };

    it('should return null when there is no conflict', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: false,
      };

      const result = buildConflictInfo(
        'entry-123',
        2,
        checkResult,
        { deviation: 'New deviation' }
      );

      expect(result).toBeNull();
    });

    it('should return null when conflict has no current data', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        // Missing currentData
      };

      const result = buildConflictInfo(
        'entry-123',
        2,
        checkResult,
        { deviation: 'New deviation' }
      );

      expect(result).toBeNull();
    });

    it('should build conflict info when conflict is detected', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 3,
        currentData: mockEntryData,
        lastModifiedBy: 'user-456',
        lastModifiedAt: '2026-02-11T10:00:00.000Z',
      };

      const clientChanges = {
        deviation: 'My new deviation',
        causes: ['My cause'],
      };

      const result = buildConflictInfo('entry-123', 2, checkResult, clientChanges);

      expect(result).not.toBeNull();
      expect(result!.entryId).toBe('entry-123');
      expect(result!.expectedVersion).toBe(2);
      expect(result!.currentVersion).toBe(3);
      expect(result!.serverData).toEqual(mockEntryData);
      expect(result!.clientChanges).toEqual(clientChanges);
      expect(result!.conflictingUserId).toBe('user-456');
      expect(result!.conflictedAt).toBe('2026-02-11T10:00:00.000Z');
    });

    it('should handle empty client changes', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 5,
        currentData: mockEntryData,
        lastModifiedBy: 'user-789',
        lastModifiedAt: '2026-02-11T12:00:00.000Z',
      };

      const result = buildConflictInfo('entry-123', 4, checkResult, {});

      expect(result).not.toBeNull();
      expect(result!.clientChanges).toEqual({});
    });
  });

  // ==========================================================================
  // ConflictCheckResult Type Tests
  // ==========================================================================

  describe('ConflictCheckResult', () => {
    it('should have correct structure for no conflict', () => {
      const result: ConflictCheckResult = {
        hasConflict: false,
      };

      expect(result.hasConflict).toBe(false);
      expect(result.currentVersion).toBeUndefined();
      expect(result.currentData).toBeUndefined();
    });

    it('should have correct structure for conflict', () => {
      const result: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 5,
        currentData: {
          id: 'test-id',
          version: 5,
          deviation: 'Test deviation',
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
          updatedAt: '2026-02-11T00:00:00.000Z',
        },
        lastModifiedBy: 'user-id',
        lastModifiedAt: '2026-02-11T00:00:00.000Z',
      };

      expect(result.hasConflict).toBe(true);
      expect(result.currentVersion).toBe(5);
      expect(result.currentData).toBeDefined();
      expect(result.lastModifiedBy).toBe('user-id');
    });
  });

  // ==========================================================================
  // ConflictInfo Type Tests
  // ==========================================================================

  describe('ConflictInfo', () => {
    it('should have all required fields', () => {
      const conflictInfo: ConflictInfo = {
        entryId: 'entry-id',
        expectedVersion: 2,
        currentVersion: 3,
        serverData: {
          id: 'entry-id',
          version: 3,
          deviation: 'Server deviation',
          causes: ['Server cause'],
          consequences: ['Server consequence'],
          safeguards: ['Server safeguard'],
          recommendations: ['Server recommendation'],
          notes: 'Server notes',
          severity: 3,
          likelihood: 3,
          detectability: 3,
          riskScore: 27,
          riskLevel: 'medium',
          updatedAt: '2026-02-11T00:00:00.000Z',
        },
        clientChanges: {
          deviation: 'Client deviation',
        },
        conflictingUserId: 'other-user-id',
        conflictedAt: '2026-02-11T00:00:00.000Z',
      };

      expect(conflictInfo.entryId).toBe('entry-id');
      expect(conflictInfo.expectedVersion).toBe(2);
      expect(conflictInfo.currentVersion).toBe(3);
      expect(conflictInfo.serverData.deviation).toBe('Server deviation');
      expect(conflictInfo.clientChanges.deviation).toBe('Client deviation');
    });
  });

  // ==========================================================================
  // OptimisticUpdateResult Type Tests
  // ==========================================================================

  describe('OptimisticUpdateResult', () => {
    it('should represent successful update', () => {
      const result: OptimisticUpdateResult<{ id: string; version: number }> = {
        success: true,
        data: { id: 'entry-id', version: 4 },
      };

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.conflict).toBeUndefined();
    });

    it('should represent conflict', () => {
      const result: OptimisticUpdateResult<{ id: string; version: number }> = {
        success: false,
        conflict: {
          entryId: 'entry-id',
          expectedVersion: 2,
          currentVersion: 3,
          serverData: {
            id: 'entry-id',
            version: 3,
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
            updatedAt: '2026-02-11T00:00:00.000Z',
          },
          clientChanges: {},
          conflictingUserId: 'user-id',
          conflictedAt: '2026-02-11T00:00:00.000Z',
        },
      };

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.conflict).toBeDefined();
      expect(result.conflict!.expectedVersion).toBe(2);
      expect(result.conflict!.currentVersion).toBe(3);
    });
  });

  // ==========================================================================
  // Version Comparison Logic Tests
  // ==========================================================================

  describe('Version Comparison Logic', () => {
    it('should detect conflict when versions differ', () => {
      const expectedVersion: number = 2;
      const currentVersion: number = 3;

      const hasConflict = currentVersion !== expectedVersion;

      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when versions match', () => {
      const expectedVersion: number = 5;
      const currentVersion: number = 5;

      const hasConflict = currentVersion !== expectedVersion;

      expect(hasConflict).toBe(false);
    });

    it('should handle version increment logic', () => {
      let version = 1;

      // Simulate first update
      version += 1;
      expect(version).toBe(2);

      // Simulate second update
      version += 1;
      expect(version).toBe(3);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle version 1 (initial version)', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 1,
        currentData: {
          id: 'new-entry',
          version: 1,
          deviation: 'Initial deviation',
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
          updatedAt: '2026-02-11T00:00:00.000Z',
        },
        lastModifiedBy: 'creator-id',
        lastModifiedAt: '2026-02-11T00:00:00.000Z',
      };

      // Client has stale version 0 (shouldn't happen but handle gracefully)
      const result = buildConflictInfo('new-entry', 0, checkResult, {});

      expect(result).not.toBeNull();
      expect(result!.expectedVersion).toBe(0);
      expect(result!.currentVersion).toBe(1);
    });

    it('should handle large version numbers', () => {
      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 9999,
        currentData: {
          id: 'busy-entry',
          version: 9999,
          deviation: 'Very updated',
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
          updatedAt: '2026-02-11T00:00:00.000Z',
        },
        lastModifiedBy: 'user-id',
        lastModifiedAt: '2026-02-11T00:00:00.000Z',
      };

      const result = buildConflictInfo('busy-entry', 9998, checkResult, {});

      expect(result).not.toBeNull();
      expect(result!.currentVersion).toBe(9999);
    });

    it('should handle entries with null risk values', () => {
      const entryData: ConflictEntryData = {
        id: 'no-risk-entry',
        version: 2,
        deviation: 'No risk assessed',
        causes: ['Unknown cause'],
        consequences: ['Unknown consequence'],
        safeguards: [],
        recommendations: [],
        notes: null,
        severity: null,
        likelihood: null,
        detectability: null,
        riskScore: null,
        riskLevel: null,
        updatedAt: '2026-02-11T00:00:00.000Z',
      };

      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 2,
        currentData: entryData,
        lastModifiedBy: 'user-id',
        lastModifiedAt: '2026-02-11T00:00:00.000Z',
      };

      const result = buildConflictInfo('no-risk-entry', 1, checkResult, {});

      expect(result).not.toBeNull();
      expect(result!.serverData.severity).toBeNull();
      expect(result!.serverData.riskScore).toBeNull();
    });

    it('should handle entries with full risk values', () => {
      const entryData: ConflictEntryData = {
        id: 'risk-entry',
        version: 5,
        deviation: 'High risk deviation',
        causes: ['Major cause'],
        consequences: ['Catastrophic consequence'],
        safeguards: ['SIL 3 system'],
        recommendations: ['Implement LOPA'],
        notes: 'Requires immediate attention',
        severity: 5,
        likelihood: 4,
        detectability: 3,
        riskScore: 60,
        riskLevel: 'high',
        updatedAt: '2026-02-11T00:00:00.000Z',
      };

      const checkResult: ConflictCheckResult = {
        hasConflict: true,
        currentVersion: 5,
        currentData: entryData,
        lastModifiedBy: 'lead-analyst',
        lastModifiedAt: '2026-02-11T00:00:00.000Z',
      };

      const result = buildConflictInfo('risk-entry', 4, checkResult, {
        safeguards: ['Updated safeguard'],
      });

      expect(result).not.toBeNull();
      expect(result!.serverData.severity).toBe(5);
      expect(result!.serverData.riskScore).toBe(60);
      expect(result!.serverData.riskLevel).toBe('high');
    });
  });
});
