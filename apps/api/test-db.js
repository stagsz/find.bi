import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'hazop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

console.log('Testing database connection with:');
console.log('  Host:', process.env.DB_HOST || 'localhost');
console.log('  Port:', process.env.DB_PORT || '5432');
console.log('  Database:', process.env.DB_NAME || 'hazop');
console.log('  User:', process.env.DB_USER || 'postgres');
console.log('  Password:', process.env.DB_PASSWORD ? '****' : '(not set)');
console.log('');

try {
  const result = await pool.query("SELECT COUNT(*) FROM users WHERE email = 'admin@hazop.local'");
  console.log('✓ Database connection successful!');
  console.log('✓ Admin user count:', result.rows[0].count);

  if (result.rows[0].count === '0') {
    console.log('⚠ Admin user NOT found - need to run migration 013');
  }

  await pool.end();
} catch(err) {
  console.error('✗ Database error:', err.message);
  console.error('✗ Error code:', err.code);
  process.exit(1);
}
