-- Migration: 015_add_version_to_analysis_entries
-- Description: Add version column to analysis_entries for optimistic locking
-- Task: COLLAB-05
-- Date: 2026-02-11

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- ADD VERSION COLUMN FOR OPTIMISTIC LOCKING
-- ============================================================================
-- The version column enables conflict detection for concurrent edits.
-- When an entry is updated, the version must match the current version.
-- If not, a conflict is detected and the update is rejected.

ALTER TABLE analysis_entries
    ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add check constraint to ensure version is positive
ALTER TABLE analysis_entries
    ADD CONSTRAINT analysis_entries_version_positive CHECK (version >= 1);

-- Add index for efficient version lookups (useful for conflict detection queries)
CREATE INDEX idx_analysis_entries_version
    ON analysis_entries (id, version);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN analysis_entries.version IS
    'Optimistic locking version number. Incremented on each update. '
    'Used for conflict detection in concurrent edit scenarios.';
