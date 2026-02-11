/**
 * Conflict detection service for concurrent edit handling.
 *
 * Provides optimistic locking functionality for analysis entries,
 * detecting when concurrent edits would result in data conflicts.
 *
 * The service uses a version-based approach:
 * 1. Each entry has a version number starting at 1
 * 2. On update, the client must provide the expected version
 * 3. If the current version doesn't match, a conflict is detected
 * 4. On successful update, the version is incremented
 */

import { getPool } from '../config/database.config.js';
import type { RiskLevel } from '@hazop/types';

/**
 * Result of a conflict check.
 */
export interface ConflictCheckResult {
  /** Whether a conflict was detected */
  hasConflict: boolean;

  /** Current version in the database (if conflict) */
  currentVersion?: number;

  /** The current state of the entry (if conflict) */
  currentData?: ConflictEntryData;

  /** User ID who made the last update (if conflict) */
  lastModifiedBy?: string;

  /** Timestamp of the last update (if conflict) */
  lastModifiedAt?: string;
}

/**
 * Entry data for conflict comparison.
 */
export interface ConflictEntryData {
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
  riskLevel: RiskLevel | null;
  updatedAt: string;
}

/**
 * Information about a detected conflict.
 */
export interface ConflictInfo {
  /** Entry ID that has a conflict */
  entryId: string;

  /** Version the client expected */
  expectedVersion: number;

  /** Actual current version in the database */
  currentVersion: number;

  /** Current state of the entry in the database */
  serverData: ConflictEntryData;

  /** Changes the client was trying to make */
  clientChanges: Record<string, unknown>;

  /** User ID who made the conflicting update */
  conflictingUserId: string;

  /** Timestamp of the conflicting update */
  conflictedAt: string;
}

/**
 * Result of an optimistic update attempt.
 */
export interface OptimisticUpdateResult<T> {
  /** Whether the update was successful */
  success: boolean;

  /** The updated data (if successful) */
  data?: T;

  /** Conflict information (if not successful) */
  conflict?: ConflictInfo;
}

/**
 * Check if an entry version matches the expected version.
 *
 * @param entryId - The entry ID to check
 * @param expectedVersion - The version the client expects
 * @returns Conflict check result
 */
export async function checkEntryVersion(
  entryId: string,
  expectedVersion: number
): Promise<ConflictCheckResult> {
  const pool = getPool();

  const result = await pool.query<{
    id: string;
    version: number;
    deviation: string;
    causes: string;
    consequences: string;
    safeguards: string;
    recommendations: string;
    notes: string | null;
    severity: number | null;
    likelihood: number | null;
    detectability: number | null;
    risk_score: number | null;
    risk_level: RiskLevel | null;
    updated_at: Date;
    created_by_id: string;
  }>(
    `SELECT id, version, deviation, causes, consequences, safeguards, recommendations,
            notes, severity, likelihood, detectability, risk_score, risk_level,
            updated_at, created_by_id
     FROM hazop.analysis_entries
     WHERE id = $1`,
    [entryId]
  );

  if (!result.rows[0]) {
    // Entry not found - no conflict (will be handled as 404 elsewhere)
    return { hasConflict: false };
  }

  const row = result.rows[0];
  const currentVersion = row.version;

  if (currentVersion === expectedVersion) {
    // Versions match - no conflict
    return { hasConflict: false };
  }

  // Conflict detected - return current state
  return {
    hasConflict: true,
    currentVersion,
    currentData: {
      id: row.id,
      version: row.version,
      deviation: row.deviation,
      causes: parseJsonArray(row.causes),
      consequences: parseJsonArray(row.consequences),
      safeguards: parseJsonArray(row.safeguards),
      recommendations: parseJsonArray(row.recommendations),
      notes: row.notes,
      severity: row.severity,
      likelihood: row.likelihood,
      detectability: row.detectability,
      riskScore: row.risk_score,
      riskLevel: row.risk_level,
      updatedAt: row.updated_at.toISOString(),
    },
    lastModifiedBy: row.created_by_id,
    lastModifiedAt: row.updated_at.toISOString(),
  };
}

/**
 * Get the current version of an entry.
 *
 * @param entryId - The entry ID to check
 * @returns The current version or null if entry not found
 */
export async function getEntryVersion(entryId: string): Promise<number | null> {
  const pool = getPool();

  const result = await pool.query<{ version: number }>(
    `SELECT version FROM hazop.analysis_entries WHERE id = $1`,
    [entryId]
  );

  return result.rows[0]?.version ?? null;
}

/**
 * Increment the version of an entry atomically.
 * Returns the new version number.
 *
 * @param entryId - The entry ID to increment
 * @returns The new version number or null if entry not found
 */
export async function incrementEntryVersion(entryId: string): Promise<number | null> {
  const pool = getPool();

  const result = await pool.query<{ version: number }>(
    `UPDATE hazop.analysis_entries
     SET version = version + 1
     WHERE id = $1
     RETURNING version`,
    [entryId]
  );

  return result.rows[0]?.version ?? null;
}

/**
 * Perform an optimistic update on an entry.
 * The update only succeeds if the version matches.
 *
 * @param entryId - The entry ID to update
 * @param expectedVersion - The version the client expects
 * @param updateFn - Function that performs the actual update
 * @param clientChanges - The changes the client is trying to make
 * @param userId - The user making the update
 * @returns Result of the optimistic update attempt
 */
export async function performOptimisticUpdate<T>(
  entryId: string,
  expectedVersion: number,
  updateFn: () => Promise<T | null>,
  clientChanges: Record<string, unknown>,
  _userId: string
): Promise<OptimisticUpdateResult<T>> {
  const pool = getPool();

  // Use a transaction to ensure atomicity
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the row and check version
    const checkResult = await client.query<{
      id: string;
      version: number;
      deviation: string;
      causes: string;
      consequences: string;
      safeguards: string;
      recommendations: string;
      notes: string | null;
      severity: number | null;
      likelihood: number | null;
      detectability: number | null;
      risk_score: number | null;
      risk_level: RiskLevel | null;
      updated_at: Date;
      created_by_id: string;
    }>(
      `SELECT id, version, deviation, causes, consequences, safeguards, recommendations,
              notes, severity, likelihood, detectability, risk_score, risk_level,
              updated_at, created_by_id
       FROM hazop.analysis_entries
       WHERE id = $1
       FOR UPDATE`,
      [entryId]
    );

    if (!checkResult.rows[0]) {
      await client.query('ROLLBACK');
      // Entry not found - let the update function handle this
      const result = await updateFn();
      return { success: result !== null, data: result ?? undefined };
    }

    const row = checkResult.rows[0];
    const currentVersion = row.version;

    if (currentVersion !== expectedVersion) {
      // Conflict detected
      await client.query('ROLLBACK');

      return {
        success: false,
        conflict: {
          entryId,
          expectedVersion,
          currentVersion,
          serverData: {
            id: row.id,
            version: row.version,
            deviation: row.deviation,
            causes: parseJsonArray(row.causes),
            consequences: parseJsonArray(row.consequences),
            safeguards: parseJsonArray(row.safeguards),
            recommendations: parseJsonArray(row.recommendations),
            notes: row.notes,
            severity: row.severity,
            likelihood: row.likelihood,
            detectability: row.detectability,
            riskScore: row.risk_score,
            riskLevel: row.risk_level,
            updatedAt: row.updated_at.toISOString(),
          },
          clientChanges,
          conflictingUserId: row.created_by_id,
          conflictedAt: row.updated_at.toISOString(),
        },
      };
    }

    // Version matches - perform the update
    await client.query('COMMIT');

    // Now perform the actual update (in a new transaction)
    const result = await updateFn();

    if (result === null) {
      return { success: false };
    }

    return { success: true, data: result };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Build conflict info from a conflict check result.
 *
 * @param entryId - The entry ID
 * @param expectedVersion - The version the client expected
 * @param checkResult - The conflict check result
 * @param clientChanges - The changes the client was trying to make
 * @returns ConflictInfo or null if no conflict
 */
export function buildConflictInfo(
  entryId: string,
  expectedVersion: number,
  checkResult: ConflictCheckResult,
  clientChanges: Record<string, unknown>
): ConflictInfo | null {
  if (!checkResult.hasConflict || !checkResult.currentData) {
    return null;
  }

  return {
    entryId,
    expectedVersion,
    currentVersion: checkResult.currentVersion!,
    serverData: checkResult.currentData,
    clientChanges,
    conflictingUserId: checkResult.lastModifiedBy!,
    conflictedAt: checkResult.lastModifiedAt!,
  };
}

/**
 * Parse a JSON string or object to a string array.
 */
function parseJsonArray(value: string | unknown): string[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}
