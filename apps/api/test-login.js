import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

console.log('Testing database connection...');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'hazop',
  user: process.env.DB_USER || 'hazop',
  password: process.env.DB_PASSWORD || 'devpassword',
});

async function test() {
  try {
    // Test connection
    console.log('\n1. Testing connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Connection successful:', result.rows[0]);

    // Check if schema exists
    console.log('\n2. Checking schema...');
    const schemaResult = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'hazop'"
    );
    console.log('Schema exists:', schemaResult.rows.length > 0);

    // Check if users table exists
    console.log('\n3. Checking users table...');
    const tableResult = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'hazop' AND table_name = 'users'"
    );
    console.log('Users table exists:', tableResult.rows.length > 0);

    // Count users
    console.log('\n4. Counting users...');
    const countResult = await pool.query('SELECT COUNT(*) FROM hazop.users');
    console.log('User count:', countResult.rows[0].count);

    // List users
    console.log('\n5. Listing users...');
    const usersResult = await pool.query('SELECT id, email, name, role FROM hazop.users');
    console.log('Users:', JSON.stringify(usersResult.rows, null, 2));

    // Find admin user
    console.log('\n6. Finding admin user...');
    const adminResult = await pool.query(
      "SELECT id, email, name, role, is_active FROM hazop.users WHERE email = 'admin@hazop.local'"
    );
    console.log('Admin user:', JSON.stringify(adminResult.rows, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

test();
