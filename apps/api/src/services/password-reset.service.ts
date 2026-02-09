/**
 * Password reset service for forgot password flow.
 *
 * Handles token generation, storage, validation, and password updates.
 * Tokens are stored as SHA-256 hashes for security.
 */

import crypto from 'crypto';
import { getPool } from '../config/database.config.js';
import { hashPassword, findUserByEmail, type UserRow } from './user.service.js';

/**
 * Password reset token row from the database.
 */
export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

/**
 * Token expiry time in milliseconds (1 hour).
 */
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Token length in bytes (32 bytes = 64 hex characters).
 */
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token.
 */
function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Hash a token using SHA-256.
 * We store the hash to prevent token theft if the database is compromised.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a password reset token for a user.
 *
 * Invalidates any existing tokens for the user before creating a new one.
 * Returns the plain token to be sent via email.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const pool = getPool();
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Invalidate any existing unused tokens for this user
  await pool.query(
    `UPDATE hazop.password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  // Create new token
  await pool.query(
    `INSERT INTO hazop.password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return token;
}

/**
 * Result of token validation.
 */
export interface ValidateTokenResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
  error?: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_USED';
}

/**
 * Validate a password reset token.
 *
 * Returns the user ID if valid, or an error code if invalid.
 */
export async function validatePasswordResetToken(token: string): Promise<ValidateTokenResult> {
  const pool = getPool();
  const tokenHash = hashToken(token);

  const result = await pool.query<PasswordResetTokenRow>(
    `SELECT id, user_id, expires_at, used_at
     FROM hazop.password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );

  const tokenRow = result.rows[0];

  if (!tokenRow) {
    return { valid: false, error: 'INVALID_TOKEN' };
  }

  if (tokenRow.used_at) {
    return { valid: false, error: 'TOKEN_USED' };
  }

  if (new Date() > tokenRow.expires_at) {
    return { valid: false, error: 'TOKEN_EXPIRED' };
  }

  return {
    valid: true,
    userId: tokenRow.user_id,
    tokenId: tokenRow.id,
  };
}

/**
 * Reset a user's password using a valid token.
 *
 * Marks the token as used and updates the password.
 * Returns true if successful, false otherwise.
 */
export async function resetPassword(token: string, newPassword: string): Promise<{
  success: boolean;
  error?: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_USED' | 'USER_NOT_FOUND';
}> {
  const pool = getPool();

  // Validate the token first
  const validation = await validatePasswordResetToken(token);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Get the user
  const userId = validation.userId!;
  const userResult = await pool.query<UserRow>(
    `SELECT id, email FROM hazop.users WHERE id = $1 AND is_active = true`,
    [userId]
  );

  if (!userResult.rows[0]) {
    return { success: false, error: 'USER_NOT_FOUND' };
  }

  // Hash the new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and mark token as used in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update the user's password
    await client.query(
      `UPDATE hazop.users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    // Mark the token as used
    await client.query(
      `UPDATE hazop.password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [validation.tokenId]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Request a password reset for an email address.
 *
 * Returns the token if the user exists (for development/testing).
 * In production, this would send an email and always return success
 * to prevent email enumeration.
 *
 * @returns Object with success status and optionally the token (for dev mode)
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  token?: string;
  userId?: string;
}> {
  // Find the user by email
  const user = await findUserByEmail(email);

  if (!user) {
    // In production, we'd return success anyway to prevent email enumeration
    // For now, we indicate user not found for development purposes
    return { success: false };
  }

  if (!user.is_active) {
    // Deactivated users cannot reset their password
    return { success: false };
  }

  // Create the reset token
  const token = await createPasswordResetToken(user.id);

  // In production, we would send an email here
  // For development, we return the token directly
  // TODO: Integrate email service when available

  return {
    success: true,
    token,
    userId: user.id,
  };
}

/**
 * Clean up expired and used tokens.
 *
 * Should be called periodically (e.g., via cron job or scheduled task).
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM hazop.password_reset_tokens
     WHERE expires_at < NOW() OR used_at IS NOT NULL`
  );
  return result.rowCount || 0;
}
