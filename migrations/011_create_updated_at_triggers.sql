-- Migration: 011_create_updated_at_triggers
-- Description: Create database triggers for automatic updated_at timestamp updates
-- Task: DB-11
-- Date: 2026-02-09

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
-- This function automatically updates the updated_at column to the current
-- timestamp whenever a row is modified. It is designed to be used with
-- BEFORE UPDATE triggers on any table with an updated_at column.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Set updated_at to current timestamp on every update
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS
    'Trigger function that automatically sets updated_at to current timestamp on row updates. '
    'Used by BEFORE UPDATE triggers on all tables with updated_at columns.';

-- ============================================================================
-- USERS TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_users_updated_at ON users IS
    'Automatically updates updated_at timestamp when a user record is modified';

-- ============================================================================
-- PROJECTS TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_projects_updated_at ON projects IS
    'Automatically updates updated_at timestamp when a project record is modified';

-- ============================================================================
-- PID_DOCUMENTS TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_pid_documents_updated_at
    BEFORE UPDATE ON pid_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_pid_documents_updated_at ON pid_documents IS
    'Automatically updates updated_at timestamp when a P&ID document record is modified';

-- ============================================================================
-- ANALYSIS_NODES TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_analysis_nodes_updated_at
    BEFORE UPDATE ON analysis_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_analysis_nodes_updated_at ON analysis_nodes IS
    'Automatically updates updated_at timestamp when an analysis node record is modified';

-- ============================================================================
-- HAZOP_ANALYSES TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_hazop_analyses_updated_at
    BEFORE UPDATE ON hazop_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_hazop_analyses_updated_at ON hazop_analyses IS
    'Automatically updates updated_at timestamp when a HazOps analysis record is modified';

-- ============================================================================
-- ANALYSIS_ENTRIES TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_analysis_entries_updated_at
    BEFORE UPDATE ON analysis_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_analysis_entries_updated_at ON analysis_entries IS
    'Automatically updates updated_at timestamp when an analysis entry record is modified';

-- ============================================================================
-- COLLABORATION_SESSIONS TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_collaboration_sessions_updated_at
    BEFORE UPDATE ON collaboration_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_collaboration_sessions_updated_at ON collaboration_sessions IS
    'Automatically updates updated_at timestamp when a collaboration session record is modified';

-- ============================================================================
-- REPORT_TEMPLATES TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_report_templates_updated_at ON report_templates IS
    'Automatically updates updated_at timestamp when a report template record is modified';

-- ============================================================================
-- REPORTS TABLE TRIGGER
-- ============================================================================

CREATE TRIGGER trg_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER trg_reports_updated_at ON reports IS
    'Automatically updates updated_at timestamp when a report record is modified';

-- ============================================================================
-- TRIGGER SUMMARY
-- ============================================================================
-- The following triggers have been created:
--
-- | Table                  | Trigger Name                        |
-- |------------------------|-------------------------------------|
-- | users                  | trg_users_updated_at                |
-- | projects               | trg_projects_updated_at             |
-- | pid_documents          | trg_pid_documents_updated_at        |
-- | analysis_nodes         | trg_analysis_nodes_updated_at       |
-- | hazop_analyses         | trg_hazop_analyses_updated_at       |
-- | analysis_entries       | trg_analysis_entries_updated_at     |
-- | collaboration_sessions | trg_collaboration_sessions_updated_at |
-- | report_templates       | trg_report_templates_updated_at     |
-- | reports                | trg_reports_updated_at              |
--
-- All triggers use the shared update_updated_at_column() function.
-- Triggers fire BEFORE UPDATE on each row modification.
