/**
 * Check if the authenticated user exists in the database
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hazop:devpassword@localhost:5432/hazop',
});

const userId = '93312827-e328-4a20-92b3-09b74439ce34'; // From JWT token in error

async function checkUser() {
  try {
    console.log('Checking user:', userId);

    const result = await pool.query(`
      SELECT id, email, name, role, organization, is_active
      FROM hazop.users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      console.log('\n✗ User NOT FOUND in database!');
      console.log('This is why analysis creation is failing.');
      console.log('\nListing all users:');

      const allUsers = await pool.query(`
        SELECT id, email, name, role, organization, is_active
        FROM hazop.users
        ORDER BY created_at DESC
      `);

      allUsers.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.name}) - ${user.role} - Active: ${user.is_active}`);
        console.log(`    ID: ${user.id}`);
      });
    } else {
      console.log('\n✓ User found:');
      const user = result.rows[0];
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Organization: ${user.organization}`);
      console.log(`  Active: ${user.is_active}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkUser();
