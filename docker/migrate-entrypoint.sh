#!/bin/bash
#
# Docker Migration Entrypoint
#
# This script is designed to be used as a Docker entrypoint or init container
# to run database migrations before starting the application.
#
# Task: DEPLOY-05
# Date: 2026-02-13
#
# Usage in docker-compose.yml:
#   migrate:
#     image: hazop-api:latest
#     command: /app/docker/migrate-entrypoint.sh
#     environment:
#       DATABASE_URL: postgresql://user:pass@postgres:5432/hazop
#
# Usage in Dockerfile:
#   ENTRYPOINT ["/app/docker/migrate-entrypoint.sh"]
#

set -e

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  HazOp Database Migration (Docker)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Default timeout for waiting on database
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"

# Parse DATABASE_URL into individual components
if [ -n "$DATABASE_URL" ]; then
    # Extract: postgresql://user:password@host:port/database
    regex="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"
    if [[ $DATABASE_URL =~ $regex ]]; then
        export DB_USER="${BASH_REMATCH[1]}"
        export DB_PASSWORD="${BASH_REMATCH[2]}"
        export DB_HOST="${BASH_REMATCH[3]}"
        export DB_PORT="${BASH_REMATCH[4]}"
        export DB_NAME="${BASH_REMATCH[5]}"
    fi
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-hazop}"

echo "→ Database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Wait for PostgreSQL to be ready
echo "→ Waiting for PostgreSQL to be ready..."

elapsed=0
until PGPASSWORD="${DB_PASSWORD:-postgres}" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
    if [ $elapsed -ge $DB_WAIT_TIMEOUT ]; then
        echo "✗ Timeout waiting for PostgreSQL after ${DB_WAIT_TIMEOUT}s"
        exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
    echo -ne "\r  Waiting... ${elapsed}s / ${DB_WAIT_TIMEOUT}s"
done

echo ""
echo "✓ PostgreSQL is ready"

# Change to app directory
cd /app

# Run migrations
echo ""
echo "→ Running database migrations..."
echo ""

# Use tsx to run the migration script
if [ -f "node_modules/.bin/tsx" ]; then
    node_modules/.bin/tsx apps/api/src/scripts/migrate.ts
else
    npx tsx apps/api/src/scripts/migrate.ts
fi

echo ""
echo "✓ Migration entrypoint completed successfully"
echo ""

# If additional command provided, execute it
if [ $# -gt 0 ]; then
    echo "→ Executing command: $@"
    exec "$@"
fi
