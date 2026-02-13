# Database Migrations

This directory contains PostgreSQL database migrations for the HazOp Assistant.

## Migration Runner

The project includes a production-ready migration runner that tracks executed migrations
and ensures safe, idempotent deployments.

### Quick Start

```bash
# From project root - run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate:status

# Preview pending migrations (dry run)
npm run db:migrate:dry-run
```

### From API Package

```bash
cd apps/api

# Run migrations
npm run migrate

# Check status
npm run migrate:status

# Dry run
npm run migrate:dry-run
```

### Production Deployment

```bash
# Using the production script
./scripts/migrate-production.sh

# With database wait (useful for container orchestration)
./scripts/migrate-production.sh --wait

# Check status in production
./scripts/migrate-production.sh --status
```

### Docker/Container Environments

Use the migration entrypoint script for Docker deployments:

```yaml
# docker-compose.yml
services:
  migrate:
    image: hazop-api:latest
    command: /app/docker/migrate-entrypoint.sh
    environment:
      DATABASE_URL: postgresql://hazop:password@postgres:5432/hazop
    depends_on:
      postgres:
        condition: service_healthy
```

Or as part of CI/CD pipeline before starting the main application.

## Migration Tracking

The migration runner uses a `hazop.schema_migrations` table to track executed migrations:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `version` | VARCHAR(255) | Migration version (e.g., "001") |
| `name` | VARCHAR(255) | Migration filename |
| `executed_at` | TIMESTAMP | When migration was executed |
| `checksum` | VARCHAR(64) | SHA-256 hash of migration content |
| `execution_time_ms` | INTEGER | Execution time in milliseconds |

This ensures:
- Migrations are only run once
- Modified migrations are detected and flagged
- Full audit trail of database changes

## Migration Naming Convention

Migrations are named with a sequential number prefix:
- `001_create_enum_types.sql` - Create custom enum types
- `002_create_users_table.sql` - Create users table
- etc.

Pattern: `{3-digit-number}_{description}.sql`

## Creating New Migrations

1. Create a new SQL file with the next sequential number:
   ```bash
   touch migrations/016_your_migration_name.sql
   ```

2. Add the migration header:
   ```sql
   -- Migration: 016_your_migration_name
   -- Description: Brief description of changes
   -- Task: TASK-ID
   -- Date: YYYY-MM-DD

   SET search_path TO hazop, public;

   -- Your SQL statements here
   ```

3. Run the migration:
   ```bash
   npm run db:migrate
   ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | Full PostgreSQL connection URL |
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 5432 | Database port |
| `DB_NAME` | hazop | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `DB_SSL` | false | Enable SSL connection |

Either provide `DATABASE_URL` or individual `DB_*` variables.

## Current Migrations

| # | File | Description |
|---|------|-------------|
| 001 | `001_create_enum_types.sql` | Custom PostgreSQL enum types |
| 002 | `002_create_users_table.sql` | Users and authentication |
| 003 | `003_create_projects_tables.sql` | Projects and members |
| 004 | `004_create_pid_documents_table.sql` | P&ID document storage |
| 005 | `005_create_analysis_nodes_table.sql` | Analysis nodes |
| 006 | `006_create_hazop_analyses_tables.sql` | HazOp analysis entries |
| 007 | `007_create_collaboration_tables.sql` | Collaboration sessions |
| 008 | `008_create_audit_log_table.sql` | Audit trail |
| 009 | `009_create_reports_tables.sql` | Reports and templates |
| 010 | `010_add_performance_indexes.sql` | Performance indexes |
| 011 | `011_create_updated_at_triggers.sql` | Auto-update triggers |
| 012 | `012_create_password_reset_tokens_table.sql` | Password reset tokens |
| 013 | `013_seed_admin_user.sql` | Initial admin user |
| 014 | `014_create_lopa_analyses_table.sql` | LOPA analysis data |
| 015 | `015_add_version_to_analysis_entries.sql` | Optimistic locking |

## Enum Types Reference

| Type | Values | Description |
|------|--------|-------------|
| `user_role` | administrator, lead_analyst, analyst, viewer | System user roles |
| `project_status` | planning, active, review, completed, archived | Project lifecycle |
| `project_member_role` | owner, lead, member, viewer | Project-specific roles |
| `equipment_type` | pump, valve, reactor, heat_exchanger, pipe, tank, other | P&ID equipment |
| `guide_word` | no, more, less, reverse, early, late, other_than | HazOp guide words |
| `risk_level` | low, medium, high | Risk assessment levels |
| `analysis_status` | draft, in_review, approved, rejected | Analysis workflow |
| `pid_document_status` | pending, processing, processed, failed | Document processing |
| `report_format` | pdf, word, excel, powerpoint | Report output formats |
| `report_status` | pending, generating, completed, failed | Report generation |
| `audit_operation` | INSERT, UPDATE, DELETE | Audit log operations |
| `collaboration_session_status` | active, paused, ended | Collaboration session status |

## Schema

All tables are created in the `hazop` schema to isolate application data.

```sql
SET search_path TO hazop, public;
```

## Troubleshooting

### Migration Checksum Mismatch

If you see "Migration XXX has been modified after execution", it means the SQL file
was changed after being run. Options:

1. **Restore the original file** - If the change was accidental
2. **Create a new migration** - If the change is intentional, create a new migration
   with the required changes

### Connection Issues

```bash
# Test database connectivity
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1"

# Check if schema exists
psql ... -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'hazop'"
```

### Reset Migration Tracking (Development Only)

```sql
-- WARNING: Only for development - removes migration history
DROP TABLE IF EXISTS hazop.schema_migrations;
```
