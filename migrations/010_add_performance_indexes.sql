-- Migration: 010_add_performance_indexes
-- Description: Add performance indexes for all tables (consolidation and additional optimizations)
-- Task: DB-10
-- Date: 2026-02-09

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- PERFORMANCE INDEX REVIEW AND ADDITIONS
-- ============================================================================
-- This migration consolidates index optimization for all tables.
-- Many indexes were already created in individual table migrations.
-- This file adds additional indexes for common query patterns not yet covered.

-- ============================================================================
-- USERS TABLE - Additional Indexes
-- ============================================================================

-- Composite index for active users by role (common auth/admin query)
CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON users (role, is_active)
    WHERE is_active = TRUE;

-- Composite index for organization + role queries (team listing by role)
CREATE INDEX IF NOT EXISTS idx_users_organization_role
    ON users (organization, role);

-- Index for sorting users by creation date (admin user listing)
CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users (created_at DESC);

-- ============================================================================
-- PROJECTS TABLE - Additional Indexes
-- ============================================================================

-- Composite index for organization + status (filtered project listings)
CREATE INDEX IF NOT EXISTS idx_projects_organization_status
    ON projects (organization, status);

-- Composite index for created_by + status (user's own projects filtered by status)
CREATE INDEX IF NOT EXISTS idx_projects_created_by_status
    ON projects (created_by_id, status);

-- Index for updated_at to support sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_projects_updated_at
    ON projects (updated_at DESC);

-- ============================================================================
-- PROJECT_MEMBERS TABLE - Additional Indexes
-- ============================================================================

-- Composite index for user + role (finding user's lead/owner projects)
CREATE INDEX IF NOT EXISTS idx_project_members_user_role
    ON project_members (user_id, role);

-- Index for joined_at (recent team additions)
CREATE INDEX IF NOT EXISTS idx_project_members_joined_at
    ON project_members (joined_at DESC);

-- ============================================================================
-- PID_DOCUMENTS TABLE - Additional Indexes
-- ============================================================================

-- Index for filename search (case-insensitive pattern matching support)
-- Using btree for LIKE 'prefix%' queries
CREATE INDEX IF NOT EXISTS idx_pid_documents_filename
    ON pid_documents (filename varchar_pattern_ops);

-- Composite index for uploaded_by + status (user's own uploads filtered)
CREATE INDEX IF NOT EXISTS idx_pid_documents_uploaded_by_status
    ON pid_documents (uploaded_by_id, status);

-- Index for mime_type (filtering by file type)
CREATE INDEX IF NOT EXISTS idx_pid_documents_mime_type
    ON pid_documents (mime_type);

-- Partial index for pending documents (processing queue)
CREATE INDEX IF NOT EXISTS idx_pid_documents_pending
    ON pid_documents (uploaded_at ASC)
    WHERE status = 'pending';

-- Partial index for processing documents (in-progress monitoring)
CREATE INDEX IF NOT EXISTS idx_pid_documents_processing
    ON pid_documents (uploaded_at ASC)
    WHERE status = 'processing';

-- ============================================================================
-- ANALYSIS_NODES TABLE - Additional Indexes
-- ============================================================================

-- Index for updated_at (recent modifications)
CREATE INDEX IF NOT EXISTS idx_analysis_nodes_updated_at
    ON analysis_nodes (updated_at DESC);

-- Index for node_id text search (finding nodes by user-defined ID)
CREATE INDEX IF NOT EXISTS idx_analysis_nodes_node_id
    ON analysis_nodes (node_id varchar_pattern_ops);

-- ============================================================================
-- HAZOP_ANALYSES TABLE - Additional Indexes
-- ============================================================================

-- Composite index for lead_analyst + status (analyst's pending reviews)
CREATE INDEX IF NOT EXISTS idx_hazop_analyses_lead_analyst_status
    ON hazop_analyses (lead_analyst_id, status);

-- Index for updated_at (recent activity sorting)
CREATE INDEX IF NOT EXISTS idx_hazop_analyses_updated_at
    ON hazop_analyses (updated_at DESC);

-- Partial index for analyses in review (approval queue)
CREATE INDEX IF NOT EXISTS idx_hazop_analyses_in_review
    ON hazop_analyses (submitted_at ASC)
    WHERE status = 'in_review';

-- Partial index for draft analyses (work in progress)
CREATE INDEX IF NOT EXISTS idx_hazop_analyses_draft
    ON hazop_analyses (updated_at DESC)
    WHERE status = 'draft';

-- Composite index for approver + status (approval history)
CREATE INDEX IF NOT EXISTS idx_hazop_analyses_approved_by
    ON hazop_analyses (approved_by_id, status)
    WHERE approved_by_id IS NOT NULL;

-- ============================================================================
-- ANALYSIS_ENTRIES TABLE - Additional Indexes
-- ============================================================================

-- Composite index for node + guide_word (node analysis completeness check)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_node_guideword
    ON analysis_entries (node_id, guide_word);

-- Index for parameter (filtering entries by parameter type)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_parameter
    ON analysis_entries (parameter);

-- Composite index for severity (high severity entries)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_severity
    ON analysis_entries (severity DESC NULLS LAST)
    WHERE severity IS NOT NULL;

-- Composite index for analysis + severity (risk prioritization)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_analysis_severity
    ON analysis_entries (analysis_id, severity DESC NULLS LAST)
    WHERE severity IS NOT NULL;

-- Index for updated_at (recent changes)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_updated_at
    ON analysis_entries (updated_at DESC);

-- Partial index for unassessed entries (entries without risk ranking)
CREATE INDEX IF NOT EXISTS idx_analysis_entries_unassessed
    ON analysis_entries (analysis_id, created_at)
    WHERE risk_score IS NULL;

-- ============================================================================
-- COLLABORATION_SESSIONS TABLE - Additional Indexes
-- ============================================================================

-- Index for updated_at (session activity tracking)
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_updated_at
    ON collaboration_sessions (updated_at DESC);

-- Partial index for active sessions only (live collaboration queries)
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_active_only
    ON collaboration_sessions (analysis_id)
    WHERE status = 'active';

-- ============================================================================
-- SESSION_PARTICIPANTS TABLE - Additional Indexes
-- ============================================================================

-- Index for user collaboration history with time ordering
CREATE INDEX IF NOT EXISTS idx_session_participants_user_time
    ON session_participants (user_id, joined_at DESC);

-- ============================================================================
-- AUDIT_LOG TABLE - Additional Indexes
-- ============================================================================

-- Composite index for table + operation (specific operation type on table)
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation
    ON audit_log (table_name, operation);

-- Partial index for recent inserts (new record monitoring)
CREATE INDEX IF NOT EXISTS idx_audit_log_recent_inserts
    ON audit_log (created_at DESC)
    WHERE operation = 'INSERT';

-- Partial index for recent deletes (deletion monitoring)
CREATE INDEX IF NOT EXISTS idx_audit_log_recent_deletes
    ON audit_log (created_at DESC)
    WHERE operation = 'DELETE';

-- ============================================================================
-- REPORTS TABLE - Additional Indexes
-- ============================================================================

-- Index for template_used (finding reports by template)
CREATE INDEX IF NOT EXISTS idx_reports_template_used
    ON reports (template_used);

-- Composite index for format + status (monitoring by format)
CREATE INDEX IF NOT EXISTS idx_reports_format_status
    ON reports (format, status);

-- Index for updated_at (recent activity)
CREATE INDEX IF NOT EXISTS idx_reports_updated_at
    ON reports (updated_at DESC);

-- ============================================================================
-- REPORT_TEMPLATES TABLE - Additional Indexes
-- ============================================================================

-- Index for name search (finding templates by name)
CREATE INDEX IF NOT EXISTS idx_report_templates_name
    ON report_templates (name varchar_pattern_ops);

-- Index for updated_at (recent modifications)
CREATE INDEX IF NOT EXISTS idx_report_templates_updated_at
    ON report_templates (updated_at DESC);

-- Composite index for active templates sorted by name (UI dropdown listing)
CREATE INDEX IF NOT EXISTS idx_report_templates_active_name
    ON report_templates (name)
    WHERE is_active = TRUE;

-- ============================================================================
-- STATISTICS REFRESH
-- ============================================================================
-- After creating indexes, it's recommended to analyze the tables
-- to update PostgreSQL's query planner statistics.
-- This should be run after data is loaded, not during migration.

-- ANALYZE users;
-- ANALYZE projects;
-- ANALYZE project_members;
-- ANALYZE pid_documents;
-- ANALYZE analysis_nodes;
-- ANALYZE hazop_analyses;
-- ANALYZE analysis_entries;
-- ANALYZE collaboration_sessions;
-- ANALYZE session_participants;
-- ANALYZE audit_log;
-- ANALYZE reports;
-- ANALYZE report_templates;

-- ============================================================================
-- INDEX MAINTENANCE NOTES
-- ============================================================================
-- For production environments, consider:
--
-- 1. Regular REINDEX for frequently updated tables:
--    REINDEX TABLE analysis_entries;
--
-- 2. Monitor index usage to identify unused indexes:
--    SELECT schemaname, tablename, indexname, idx_scan
--    FROM pg_stat_user_indexes
--    WHERE schemaname = 'hazop'
--    ORDER BY idx_scan ASC;
--
-- 3. Monitor index size:
--    SELECT schemaname, tablename, indexname,
--           pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
--    FROM pg_stat_user_indexes
--    WHERE schemaname = 'hazop'
--    ORDER BY pg_relation_size(indexrelid) DESC;
--
-- 4. Consider pg_repack for online index rebuilds without table locks
