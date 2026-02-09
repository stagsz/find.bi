-- Migration: 008_create_audit_log_table
-- Description: Create audit_log table for tracking changes to database records
-- Task: DB-08
-- Date: 2026-02-09

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- AUDIT_LOG TABLE
-- ============================================================================
-- Stores audit trail of all significant changes made to database records.
-- This table provides traceability for compliance and debugging purposes,
-- capturing who made changes, when, and what the before/after values were.

CREATE TABLE audit_log (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Name of the table that was modified
    table_name VARCHAR(100) NOT NULL,

    -- UUID of the record that was modified
    record_id UUID NOT NULL,

    -- Type of operation performed (uses audit_operation enum from 001_create_enum_types)
    operation audit_operation NOT NULL,

    -- User who performed the operation (null for system-triggered changes)
    user_id UUID DEFAULT NULL,

    -- Previous values before the change (null for INSERT operations)
    old_values JSONB DEFAULT NULL,

    -- New values after the change (null for DELETE operations)
    new_values JSONB DEFAULT NULL,

    -- Specific fields that were changed (for UPDATE operations)
    -- Stored as JSON array of field names, e.g., ["name", "status", "description"]
    changed_fields JSONB DEFAULT NULL,

    -- Timestamp when the operation occurred
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Optional metadata about the context of the change
    -- Example: { "ip_address": "192.168.1.1", "user_agent": "...", "session_id": "..." }
    metadata JSONB DEFAULT NULL,

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    -- Foreign key to users - SET NULL when user is deleted (preserve audit history)
    CONSTRAINT audit_log_fk_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,

    -- Table name must not be empty
    CONSTRAINT audit_log_table_name_not_empty CHECK (LENGTH(TRIM(table_name)) > 0),

    -- For INSERT operations, old_values should be null
    CONSTRAINT audit_log_insert_old_values CHECK (
        operation != 'INSERT' OR old_values IS NULL
    ),

    -- For DELETE operations, new_values should be null
    CONSTRAINT audit_log_delete_new_values CHECK (
        operation != 'DELETE' OR new_values IS NULL
    ),

    -- For INSERT operations, new_values should not be null
    CONSTRAINT audit_log_insert_new_values CHECK (
        operation != 'INSERT' OR new_values IS NOT NULL
    ),

    -- For DELETE operations, old_values should not be null
    CONSTRAINT audit_log_delete_old_values CHECK (
        operation != 'DELETE' OR old_values IS NOT NULL
    )
);

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE audit_log IS
    'Audit trail of all significant database changes. Tracks who made changes, '
    'when they were made, and the before/after values for compliance and debugging.';

COMMENT ON COLUMN audit_log.id IS
    'Unique identifier (UUID) for the audit log entry';

COMMENT ON COLUMN audit_log.table_name IS
    'Name of the database table that was modified (e.g., users, projects, analyses)';

COMMENT ON COLUMN audit_log.record_id IS
    'UUID of the record that was created, updated, or deleted';

COMMENT ON COLUMN audit_log.operation IS
    'Type of database operation: INSERT, UPDATE, or DELETE';

COMMENT ON COLUMN audit_log.user_id IS
    'Foreign key reference to the user who performed the operation (null for system changes)';

COMMENT ON COLUMN audit_log.old_values IS
    'JSON object containing the record values before the change (null for INSERT)';

COMMENT ON COLUMN audit_log.new_values IS
    'JSON object containing the record values after the change (null for DELETE)';

COMMENT ON COLUMN audit_log.changed_fields IS
    'JSON array of field names that were modified (for UPDATE operations)';

COMMENT ON COLUMN audit_log.created_at IS
    'Timestamp when the operation was performed';

COMMENT ON COLUMN audit_log.metadata IS
    'Optional JSON object with contextual information (IP address, user agent, session ID, etc.)';

-- ============================================================================
-- PERFORMANCE INDEXES FOR audit_log
-- ============================================================================

-- Index for querying audit log by table name (common for viewing history of a specific table)
CREATE INDEX idx_audit_log_table_name
    ON audit_log (table_name);

-- Index for querying audit log by record ID (viewing history of a specific record)
CREATE INDEX idx_audit_log_record_id
    ON audit_log (record_id);

-- Index for querying audit log by user (viewing actions by a specific user)
CREATE INDEX idx_audit_log_user_id
    ON audit_log (user_id);

-- Index for filtering by operation type
CREATE INDEX idx_audit_log_operation
    ON audit_log (operation);

-- Index for time-based queries (most common for audit reports)
CREATE INDEX idx_audit_log_created_at
    ON audit_log (created_at DESC);

-- Composite index for table + record queries (viewing full history of a record)
CREATE INDEX idx_audit_log_table_record
    ON audit_log (table_name, record_id);

-- Composite index for table + time queries (recent changes to a table)
CREATE INDEX idx_audit_log_table_time
    ON audit_log (table_name, created_at DESC);

-- Composite index for user + time queries (recent actions by a user)
CREATE INDEX idx_audit_log_user_time
    ON audit_log (user_id, created_at DESC);

-- GIN index for searching within old_values JSONB
CREATE INDEX idx_audit_log_old_values_gin
    ON audit_log USING GIN (old_values);

-- GIN index for searching within new_values JSONB
CREATE INDEX idx_audit_log_new_values_gin
    ON audit_log USING GIN (new_values);

-- GIN index for searching within changed_fields JSONB
CREATE INDEX idx_audit_log_changed_fields_gin
    ON audit_log USING GIN (changed_fields);

-- Partial index for non-system changes (where user_id is not null)
CREATE INDEX idx_audit_log_user_changes
    ON audit_log (created_at DESC)
    WHERE user_id IS NOT NULL;

-- ============================================================================
-- PARTITIONING NOTES (Optional for high-volume installations)
-- ============================================================================
-- For high-volume installations, consider partitioning this table by time:
--
-- CREATE TABLE audit_log (
--     ...
-- ) PARTITION BY RANGE (created_at);
--
-- CREATE TABLE audit_log_2026_01 PARTITION OF audit_log
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
--
-- This is not implemented by default as it requires additional maintenance
-- and may not be necessary for smaller installations.

-- ============================================================================
-- RETENTION POLICY NOTES
-- ============================================================================
-- Audit logs should be retained according to regulatory requirements.
-- Typical retention periods:
-- - IEC 61511: 10 years for safety-related records
-- - OSHA PSM: 5 years minimum
-- - ISO 31000: As defined by organizational policy
--
-- Consider implementing a retention policy with a scheduled job:
-- DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '10 years';
--
-- Or archive old records to cold storage before deletion.
