/**
 * JWT configuration for RS256 asymmetric token signing.
 *
 * Supports loading keys from:
 * 1. Environment variables (JWT_PRIVATE_KEY, JWT_PUBLIC_KEY)
 * 2. File paths (JWT_PRIVATE_KEY_PATH, JWT_PUBLIC_KEY_PATH)
 *
 * For development, keys can be auto-generated if not provided.
 */

export interface JwtConfig {
  /** Private key for signing tokens (PEM format) */
  privateKey: string;

  /** Public key for verifying tokens (PEM format) */
  publicKey: string;

  /** Access token expiry (e.g., '15m', '1h') */
  accessTokenExpiry: string;

  /** Refresh token expiry (e.g., '7d', '30d') */
  refreshTokenExpiry: string;

  /** Token issuer claim */
  issuer: string;

  /** Token audience claim */
  audience: string;
}

/**
 * Parse duration string to seconds.
 * Supports: 's' (seconds), 'm' (minutes), 'h' (hours), 'd' (days)
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '15m', '1h', '7d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * multipliers[unit];
}

/**
 * Load JWT configuration from environment variables.
 */
export function loadJwtConfig(): JwtConfig {
  let privateKey = process.env.JWT_PRIVATE_KEY || '';
  let publicKey = process.env.JWT_PUBLIC_KEY || '';

  if (!privateKey || !publicKey) {
    throw new Error(
      'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set. ' +
        'Generate keys with: openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem'
    );
  }

  // Convert \n escape sequences to actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
  publicKey = publicKey.replace(/\\n/g, '\n');

  return {
    privateKey,
    publicKey,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'hazop-assistant',
    audience: process.env.JWT_AUDIENCE || 'hazop-api',
  };
}
