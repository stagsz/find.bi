/**
 * User service for database operations.
 *
 * Handles user creation, retrieval, and password hashing.
 * Uses bcrypt for secure password hashing.
 */

import bcrypt from 'bcrypt';
import { getPool } from '../config/database.config.js';
import type { UserRole } from './jwt.service.js';

/**
 * User row from the database.
 * Uses snake_case column names matching PostgreSQL schema.
 */
export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  organization: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * User object without password hash (safe to return to clients).
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload for creating a new user.
 */
export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  organization: string;
}

/**
 * Number of salt rounds for bcrypt hashing.
 * 12 rounds provides good security while maintaining reasonable performance.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Convert a database row to a User object.
 * Maps snake_case columns to camelCase properties.
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    organization: row.organization,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Find a user by email.
 * Returns null if user not found.
 */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const pool = getPool();
  const result = await pool.query<UserRow>(
    `SELECT id, email, password_hash, name, role, organization, is_active, created_at, updated_at
     FROM hazop.users
     WHERE email = $1`,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
}

/**
 * Find a user by ID.
 * Returns null if user not found.
 */
export async function findUserById(id: string): Promise<User | null> {
  const pool = getPool();
  const result = await pool.query<UserRow>(
    `SELECT id, email, password_hash, name, role, organization, is_active, created_at, updated_at
     FROM hazop.users
     WHERE id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return rowToUser(result.rows[0]);
}

/**
 * Check if an email is already registered.
 */
export async function emailExists(email: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query('SELECT 1 FROM hazop.users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  return result.rows.length > 0;
}

/**
 * Create a new user.
 * Hashes the password and inserts into the database.
 * Returns the created user (without password hash).
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const pool = getPool();
  const passwordHash = await hashPassword(data.password);
  const role = data.role || 'viewer';

  const result = await pool.query<UserRow>(
    `INSERT INTO hazop.users (email, password_hash, name, role, organization)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, password_hash, name, role, organization, is_active, created_at, updated_at`,
    [data.email.toLowerCase(), passwordHash, data.name.trim(), role, data.organization.trim()]
  );

  return rowToUser(result.rows[0]);
}
