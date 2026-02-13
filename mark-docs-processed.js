/**
 * Quick script to mark all pending P&ID documents as 'processed'
 * Run with: node mark-docs-processed.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hazop:devpassword@localhost:5432/hazop',
});

async function markDocumentsProcessed() {
  try {
    console.log('Connecting to database...');

    // Mark all pending documents as processed
    const result = await pool.query(`
      UPDATE hazop.pid_documents
      SET
        status = 'processed',
        processed_at = NOW(),
        width = 1920,
        height = 1080
      WHERE status = 'pending'
      RETURNING id, filename, status
    `);

    if (result.rowCount === 0) {
      console.log('No pending documents found.');
    } else {
      console.log(`\n✓ Marked ${result.rowCount} document(s) as processed:`);
      result.rows.forEach(doc => {
        console.log(`  - ${doc.filename} (${doc.id})`);
      });
    }

    // Show all documents
    const allDocs = await pool.query(`
      SELECT id, filename, status, uploaded_at, processed_at
      FROM hazop.pid_documents
      ORDER BY uploaded_at DESC
      LIMIT 10
    `);

    console.log(`\nAll documents:`);
    allDocs.rows.forEach(doc => {
      console.log(`  ${doc.filename} - Status: ${doc.status}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

markDocumentsProcessed();
