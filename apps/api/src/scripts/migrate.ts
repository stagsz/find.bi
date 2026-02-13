/**
 * Database Migration Runner
 *
 * Production-ready migration script that:
 * - Tracks executed migrations in a schema_migrations table
 * - Runs pending migrations in order
 * - Supports --status to view migration status
 * - Supports --dry-run to preview pending migrations
 *
 * Task: DEPLOY-05
 * Date: 2026-02-13
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'hazop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

// Parse command line arguments
const args = process.argv.slice(2);
const showStatus = args.includes('--status');
const dryRun = args.includes('--dry-run');
const rollbackLast = args.includes('--rollback-last');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
HazOp Database Migration Runner

Usage:
  npm run migrate              Run all pending migrations
  npm run migrate -- --status  Show migration status
  npm run migrate -- --dry-run Preview pending migrations without executing
  npm run migrate -- --help    Show this help message

Environment Variables:
  DB_HOST      Database host (default: localhost)
  DB_PORT      Database port (default: 5432)
  DB_NAME      Database name (default: hazop)
  DB_USER      Database user (default: postgres)
  DB_PASSWORD  Database password (default: postgres)
  DB_SSL       Enable SSL (default: false)
`);
  process.exit(0);
}

// Migration tracking table schema
const SCHEMA_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS hazop.schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,
  execution_time_ms INTEGER
);

COMMENT ON TABLE hazop.schema_migrations IS 'Tracks database migration history';
COMMENT ON COLUMN hazop.schema_migrations.version IS 'Migration version number (e.g., 001, 002)';
COMMENT ON COLUMN hazop.schema_migrations.name IS 'Migration file name';
COMMENT ON COLUMN hazop.schema_migrations.executed_at IS 'When the migration was executed';
COMMENT ON COLUMN hazop.schema_migrations.checksum IS 'SHA-256 hash of migration content';
COMMENT ON COLUMN hazop.schema_migrations.execution_time_ms IS 'Time taken to execute in milliseconds';
`;

/**
 * Calculate SHA-256 checksum of migration content
 */
async function calculateChecksum(content: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Get list of migration files from disk
 */
function getMigrationFiles(migrationsDir: string): { version: string; name: string; path: string }[] {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
    .sort();

  return files.map(f => {
    const match = f.match(/^(\d{3})_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration file name: ${f}`);
    }
    return {
      version: match[1],
      name: f,
      path: path.join(migrationsDir, f),
    };
  });
}

/**
 * Get list of executed migrations from database
 */
async function getExecutedMigrations(client: pg.PoolClient): Promise<Map<string, { checksum: string; executedAt: Date }>> {
  const result = await client.query(`
    SELECT version, checksum, executed_at
    FROM hazop.schema_migrations
    ORDER BY version
  `);

  const map = new Map<string, { checksum: string; executedAt: Date }>();
  for (const row of result.rows) {
    map.set(row.version, {
      checksum: row.checksum,
      executedAt: row.executed_at,
    });
  }
  return map;
}

/**
 * Execute a single migration
 */
async function executeMigration(
  client: pg.PoolClient,
  migration: { version: string; name: string; path: string },
  checksum: string
): Promise<number> {
  const content = fs.readFileSync(migration.path, 'utf-8');
  const startTime = Date.now();

  // Execute migration SQL
  await client.query(content);

  const executionTime = Date.now() - startTime;

  // Record migration in tracking table
  await client.query(
    `INSERT INTO hazop.schema_migrations (version, name, checksum, execution_time_ms)
     VALUES ($1, $2, $3, $4)`,
    [migration.version, migration.name, checksum, executionTime]
  );

  return executionTime;
}

/**
 * Show migration status
 */
async function showMigrationStatus(
  migrations: { version: string; name: string; path: string }[],
  executed: Map<string, { checksum: string; executedAt: Date }>
): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           DATABASE MIGRATION STATUS                            ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════╣');

  let pendingCount = 0;
  let executedCount = 0;

  for (const migration of migrations) {
    const content = fs.readFileSync(migration.path, 'utf-8');
    const checksum = await calculateChecksum(content);
    const executedInfo = executed.get(migration.version);

    let status: string;
    let statusIcon: string;

    if (!executedInfo) {
      status = 'PENDING';
      statusIcon = '○';
      pendingCount++;
    } else if (executedInfo.checksum !== checksum) {
      status = 'MODIFIED';
      statusIcon = '⚠';
    } else {
      status = 'EXECUTED';
      statusIcon = '●';
      executedCount++;
    }

    const executedAt = executedInfo?.executedAt
      ? executedInfo.executedAt.toISOString().replace('T', ' ').substring(0, 19)
      : '                   ';

    console.log(`║ ${statusIcon} ${migration.version} │ ${migration.name.padEnd(45)} │ ${status.padEnd(8)} │ ${executedAt} ║`);
  }

  console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ Total: ${migrations.length}   Executed: ${executedCount}   Pending: ${pendingCount}`.padEnd(81) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
}

/**
 * Main migration runner
 */
async function main(): Promise<void> {
  console.log('\n🔄 HazOp Database Migration Runner');
  console.log('═══════════════════════════════════\n');

  // Determine migrations directory
  // When running from dist, go up to find migrations
  // When running with tsx, use relative path
  let migrationsDir = path.resolve(__dirname, '../../../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    migrationsDir = path.resolve(process.cwd(), 'migrations');
  }

  console.log(`📁 Migrations directory: ${migrationsDir}`);
  console.log(`🗄️  Database: ${config.user}@${config.host}:${config.port}/${config.database}`);

  // Create connection pool
  const pool = new pg.Pool(config);

  try {
    const client = await pool.connect();

    try {
      // Ensure schema exists
      await client.query('CREATE SCHEMA IF NOT EXISTS hazop');

      // Ensure migration tracking table exists
      await client.query(SCHEMA_MIGRATIONS_TABLE);

      // Get migration files and executed migrations
      const migrations = getMigrationFiles(migrationsDir);
      const executed = await getExecutedMigrations(client);

      console.log(`📋 Found ${migrations.length} migration files`);
      console.log(`✅ ${executed.size} migrations already executed\n`);

      // Status mode
      if (showStatus) {
        await showMigrationStatus(migrations, executed);
        return;
      }

      // Find pending migrations
      const pending: { version: string; name: string; path: string; checksum: string }[] = [];

      for (const migration of migrations) {
        const content = fs.readFileSync(migration.path, 'utf-8');
        const checksum = await calculateChecksum(content);
        const executedInfo = executed.get(migration.version);

        if (!executedInfo) {
          pending.push({ ...migration, checksum });
        } else if (executedInfo.checksum !== checksum) {
          console.error(`❌ Migration ${migration.version} has been modified after execution!`);
          console.error(`   Expected checksum: ${executedInfo.checksum}`);
          console.error(`   Current checksum:  ${checksum}`);
          console.error('\n   This indicates the migration file was changed after being run.');
          console.error('   Please restore the original file or create a new migration.\n');
          process.exit(1);
        }
      }

      if (pending.length === 0) {
        console.log('✨ All migrations are up to date!\n');
        return;
      }

      console.log(`🔍 Found ${pending.length} pending migration(s):\n`);
      for (const m of pending) {
        console.log(`   ${m.version} - ${m.name}`);
      }
      console.log('');

      // Dry run mode
      if (dryRun) {
        console.log('🔒 Dry run mode - no changes made\n');
        return;
      }

      // Execute pending migrations
      console.log('🚀 Executing migrations...\n');

      for (const migration of pending) {
        process.stdout.write(`   ▶ ${migration.version} - ${migration.name}... `);

        try {
          const startTime = Date.now();

          // Run migration in a transaction
          await client.query('BEGIN');
          const executionTime = await executeMigration(client, migration, migration.checksum);
          await client.query('COMMIT');

          console.log(`✅ (${executionTime}ms)`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.log('❌ FAILED');
          console.error(`\n   Error: ${error instanceof Error ? error.message : String(error)}\n`);
          process.exit(1);
        }
      }

      console.log('\n✨ All migrations completed successfully!\n');
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// Run migration
main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
