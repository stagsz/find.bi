/**
 * Check the database schema for pid_documents table
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hazop:devpassword@localhost:5432/hazop',
});

async function checkSchema() {
  try {
    console.log('Checking pid_documents table schema...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'hazop'
        AND table_name = 'pid_documents'
      ORDER BY ordinal_position
    `);

    console.log('Columns in hazop.pid_documents:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
    });

    console.log('\n\nChecking hazop_analyses table schema...\n');

    const analysesResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'hazop'
        AND table_name = 'hazop_analyses'
      ORDER BY ordinal_position
    `);

    console.log('Columns in hazop.hazop_analyses:');
    analysesResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkSchema();
