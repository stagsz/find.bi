/**
 * Seed script to create the initial admin user.
 *
 * Usage: npx tsx scripts/seed-admin.ts
 *
 * Creates admin user with credentials:
 * - Email: admin@hazop.local
 * - Password: Admin123!
 * - Role: administrator
 */

import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

const ADMIN_EMAIL = 'admin@hazop.local';
const ADMIN_PASSWORD = 'Admin123!';
const SALT_ROUNDS = 10;

async function seedAdmin() {
  let pool: pg.Pool | null = null;

  try {
    // Connect to database
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://hazop:devpassword@localhost:5432/hazop';
    console.log('Connecting to database...');

    pool = new Pool({
      connectionString: databaseUrl,
    });

    // Test connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful');

    // Check if admin user already exists
    console.log(`\nChecking if admin user exists (${ADMIN_EMAIL})...`);
    const existingUser = await pool.query(
      'SELECT id, email FROM hazop.users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      console.log('✓ Admin user already exists');
      console.log(`  ID: ${existingUser.rows[0].id}`);
      console.log(`  Email: ${existingUser.rows[0].email}`);
      console.log('\nNo action needed.');
      return;
    }

    console.log('Admin user does not exist. Creating...');

    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    console.log('✓ Password hashed');

    // Insert admin user
    console.log('Inserting admin user...');
    const result = await pool.query(
      `INSERT INTO hazop.users (
        email,
        password_hash,
        name,
        role,
        organization,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, role, organization`,
      [
        ADMIN_EMAIL,
        passwordHash,
        'System Administrator',
        'administrator',
        'HazOp Systems',
        true
      ]
    );

    const user = result.rows[0];
    console.log('✓ Admin user created successfully!\n');
    console.log('User Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Organization: ${user.organization}`);
    console.log('\nLogin Credentials:');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('\nYou can now log in to the application with these credentials.');

  } catch (error: any) {
    console.error('\n✗ Error seeding admin user:');

    if (error.code === 'ECONNREFUSED') {
      console.error('  Database connection refused. Make sure PostgreSQL is running:');
      console.error('    docker compose up -d postgres');
    } else if (error.code === '3D000') {
      console.error('  Database does not exist. Run migrations first.');
    } else if (error.code === '42P01') {
      console.error('  Users table does not exist. Run migrations first.');
    } else if (error.code === '42883') {
      console.error('  Extension uuid-ossp not installed. Run migration 001 first.');
    } else {
      console.error(`  ${error.message}`);
      if (error.code) {
        console.error(`  Error code: ${error.code}`);
      }
    }

    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the seed function
seedAdmin();
