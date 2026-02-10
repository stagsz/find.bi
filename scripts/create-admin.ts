#!/usr/bin/env tsx
/**
 * Create Admin User Script
 * Creates a default admin user for development/testing
 *
 * Usage: npx tsx scripts/create-admin.ts
 */

import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;

// Database configuration from environment or defaults
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://hazop:devpassword@localhost:5432/hazop';

// Admin user credentials
const ADMIN_EMAIL = 'admin@hazop.local';
const ADMIN_PASSWORD = 'Admin123!'; // Change this in production!
const ADMIN_NAME = 'System Administrator';
const ADMIN_ORGANIZATION = 'HazOp Assistant';

async function createAdmin() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔐 Creating admin user...');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('');

    // Hash the password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Insert admin user
    const result = await pool.query(
      `INSERT INTO hazop.users (email, password_hash, name, role, organization, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           organization = EXCLUDED.organization,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
       RETURNING id, email, name, role`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME, 'administrator', ADMIN_ORGANIZATION, true]
    );

    console.log('✅ Admin user created/updated successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('User Details:');
    console.log(result.rows[0]);
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password in production!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
