# Database Migrations

This directory contains PostgreSQL database migrations for the HazOp Assistant.

## Migration Naming Convention

Migrations are named with a sequential number prefix:
- `001_create_enum_types.sql` - Create custom enum types
- `002_create_users_table.sql` - Create users table
- etc.

## Running Migrations

### Development

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Connect to the database and run migrations manually
docker-compose exec postgres psql -U hazop -d hazop -f /migrations/001_create_enum_types.sql
```

### Using psql directly

```bash
# Set connection string
export DATABASE_URL="postgresql://hazop:devpassword@localhost:5432/hazop"

# Run a specific migration
psql $DATABASE_URL -f migrations/001_create_enum_types.sql

# Run all migrations in order
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

## Migration Order

1. `001_create_enum_types.sql` - Custom PostgreSQL enum types
2. `002_create_users_table.sql` - Users and authentication
3. `003_create_projects_tables.sql` - Projects and members
4. `004_create_pid_documents_table.sql` - P&ID document storage
5. `005_create_analysis_nodes_table.sql` - Analysis nodes
6. `006_create_hazop_analyses_tables.sql` - HazOp analysis entries
7. `007_create_collaboration_tables.sql` - Collaboration sessions
8. `008_create_audit_log_table.sql` - Audit trail
9. `009_create_reports_tables.sql` - Reports and templates
10. `010_create_indexes.sql` - Performance indexes
11. `011_create_triggers.sql` - Auto-update triggers

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
