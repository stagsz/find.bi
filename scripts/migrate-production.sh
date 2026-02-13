#!/bin/bash
#
# Production Database Migration Script
#
# This script runs database migrations for the HazOp Assistant.
# It is designed to be run in production environments and CI/CD pipelines.
#
# Task: DEPLOY-05
# Date: 2026-02-13
#
# Usage:
#   ./scripts/migrate-production.sh              Run all pending migrations
#   ./scripts/migrate-production.sh --status     Show migration status
#   ./scripts/migrate-production.sh --dry-run    Preview pending migrations
#   ./scripts/migrate-production.sh --help       Show help
#
# Environment Variables (required):
#   DATABASE_URL or individual DB_* variables
#
# Optional:
#   MIGRATION_TIMEOUT  Timeout for database connection (default: 30s)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${PROJECT_ROOT}/migrations"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default timeout
TIMEOUT="${MIGRATION_TIMEOUT:-30}"

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  HazOp Database Migration Runner (Production)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}! $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

show_help() {
    cat << EOF
HazOp Production Database Migration Script

Usage:
  ./scripts/migrate-production.sh [OPTIONS]

Options:
  --status     Show migration status without running migrations
  --dry-run    Preview pending migrations without executing
  --wait       Wait for database to be available before running
  --help, -h   Show this help message

Environment Variables:
  DATABASE_URL      Full PostgreSQL connection URL
                    (e.g., postgresql://user:pass@host:5432/dbname)

  OR individual variables:
  DB_HOST           Database host (default: localhost)
  DB_PORT           Database port (default: 5432)
  DB_NAME           Database name (default: hazop)
  DB_USER           Database user (default: postgres)
  DB_PASSWORD       Database password (default: postgres)
  DB_SSL            Enable SSL (true/false, default: false)

  MIGRATION_TIMEOUT Maximum time to wait for database (default: 30s)

Examples:
  # Run migrations
  DATABASE_URL="postgresql://hazop:secret@db:5432/hazop" ./scripts/migrate-production.sh

  # Check status only
  ./scripts/migrate-production.sh --status

  # Wait for database and run migrations (useful in Docker)
  ./scripts/migrate-production.sh --wait
EOF
}

# Parse DATABASE_URL if provided
parse_database_url() {
    if [ -n "$DATABASE_URL" ]; then
        # Extract components from DATABASE_URL
        # Format: postgresql://user:password@host:port/database
        local regex="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"
        if [[ $DATABASE_URL =~ $regex ]]; then
            export DB_USER="${BASH_REMATCH[1]}"
            export DB_PASSWORD="${BASH_REMATCH[2]}"
            export DB_HOST="${BASH_REMATCH[3]}"
            export DB_PORT="${BASH_REMATCH[4]}"
            export DB_NAME="${BASH_REMATCH[5]}"
        fi
    fi
}

# Wait for database to be available
wait_for_db() {
    print_info "Waiting for database to be available..."

    local host="${DB_HOST:-localhost}"
    local port="${DB_PORT:-5432}"
    local user="${DB_USER:-postgres}"
    local dbname="${DB_NAME:-hazop}"
    local elapsed=0

    while [ $elapsed -lt $TIMEOUT ]; do
        if PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "$host" -p "$port" -U "$user" -d "$dbname" -c "SELECT 1" > /dev/null 2>&1; then
            print_success "Database is available"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
        echo -ne "\r  Waiting... ${elapsed}s / ${TIMEOUT}s"
    done

    echo ""
    print_error "Timeout waiting for database after ${TIMEOUT}s"
    exit 1
}

# Check if Node.js is available
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 20 ]; then
        print_error "Node.js 20+ is required (found: $(node -v))"
        exit 1
    fi

    print_success "Node.js $(node -v) detected"
}

# Check if tsx is available, install if needed
check_tsx() {
    if ! npx tsx --version &> /dev/null 2>&1; then
        print_warning "tsx not found, will use npx"
    fi
}

# Run migrations using the Node.js script
run_migrations() {
    local args="$@"

    print_info "Running migrations..."
    echo ""

    cd "$PROJECT_ROOT"

    # Run the migration script with tsx
    if [ -f "node_modules/.bin/tsx" ]; then
        node_modules/.bin/tsx apps/api/src/scripts/migrate.ts $args
    else
        npx tsx apps/api/src/scripts/migrate.ts $args
    fi
}

# Main function
main() {
    local wait_for_database=false
    local migration_args=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --status)
                migration_args="--status"
                shift
                ;;
            --dry-run)
                migration_args="--dry-run"
                shift
                ;;
            --wait)
                wait_for_database=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    print_header

    # Parse DATABASE_URL if provided
    parse_database_url

    # Display configuration
    print_info "Configuration:"
    echo "  Host:     ${DB_HOST:-localhost}"
    echo "  Port:     ${DB_PORT:-5432}"
    echo "  Database: ${DB_NAME:-hazop}"
    echo "  User:     ${DB_USER:-postgres}"
    echo "  SSL:      ${DB_SSL:-false}"
    echo ""

    # Check prerequisites
    check_node
    check_tsx

    # Wait for database if requested
    if [ "$wait_for_database" = true ]; then
        wait_for_db
    fi

    # Run migrations
    run_migrations $migration_args

    print_success "Migration process completed"
}

# Run main function
main "$@"
