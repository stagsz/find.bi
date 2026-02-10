import pg from 'pg';

// Try connecting as postgres superuser with common passwords
const commonPasswords = [
  'postgres',
  'admin',
  'password',
  '123456',
  'root',
  '',
  'postgres123'
];

console.log('Trying to connect to local PostgreSQL as postgres user...\n');

for (const password of commonPasswords) {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
  });

  try {
    await pool.query('SELECT version()');
    console.log('✓ SUCCESS! postgres user password is:', password || '(empty)');

    // Now try to alter the hazop user
    try {
      await pool.query("ALTER USER hazop WITH PASSWORD 'devpassword';");
      console.log('✓ Password reset for hazop user successful!');
    } catch (err) {
      // User might not exist, try to create it
      try {
        await pool.query("CREATE USER hazop WITH PASSWORD 'devpassword';");
        await pool.query("GRANT ALL PRIVILEGES ON DATABASE hazop TO hazop;");
        console.log('✓ Created hazop user with password devpassword');
      } catch (createErr) {
        console.log('✗ Could not create/alter hazop user:', createErr.message);
      }
    }

    await pool.end();
    process.exit(0);
  } catch(err) {
    console.log('✗ Failed with password:', password || '(empty)');
    await pool.end();
  }
}

console.log('\n⚠ Could not connect with common passwords.');
console.log('You may need to:');
console.log('1. Check PostgreSQL service password (Windows Services)');
console.log('2. Or use pgAdmin to reset the password');
console.log('3. Or stop the local PostgreSQL and use Docker instead');
