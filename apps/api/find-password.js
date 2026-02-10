import pg from 'pg';

const passwords = [
  'devpassword',
  'hazop',
  'hazop123',
  'postgres',
  'password',
  'admin',
  ''
];

console.log('Testing different passwords for user "hazop"...\n');

for (const password of passwords) {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'hazop',
    user: 'hazop',
    password: password,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✓ SUCCESS! Password is:', password || '(empty)');
    await pool.end();
    process.exit(0);
  } catch(err) {
    console.log('✗ Failed with password:', password || '(empty)');
    await pool.end();
  }
}

console.log('\n⚠ None of the tested passwords worked.');
console.log('You may need to reset the PostgreSQL password or recreate the database.');
