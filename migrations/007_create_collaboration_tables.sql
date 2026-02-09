-- Migration: 007_create_collaboration_tables
-- Description: Create collaboration_sessions and session_participants tables for real-time collaboration
-- Task: DB-07
-- Date: 2026-02-09

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- COLLABORATION SESSION STATUS ENUM
-- ============================================================================
-- Status of a real-time collaboration session

CREATE TYPE collaboration_session_status AS ENUM (
    'active',
    'paused',
    'ended'
);

COMMENT ON TYPE collaboration_session_status IS 'Status of a real-time collaboration session';

-- ============================================================================
-- COLLABORATION_SESSIONS TABLE
-- ============================================================================
-- Stores real-time collaboration sessions for HazOps analyses.
-- Multiple users can join a session to collaboratively work on an analysis.

CREATE TABLE collaboration_sessions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to hazop_analyses table
    analysis_id UUID NOT NULL,

    -- Session name/title (optional, defaults to analysis name + timestamp)
    name VARCHAR(255) DEFAULT NULL,

    -- Current status of the collaboration session
    status collaboration_session_status NOT NULL DEFAULT 'active',

    -- User who initiated this collaboration session
    created_by_id UUID NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Session end timestamp (null if session is still active or paused)
    ended_at TIMESTAMPTZ DEFAULT NULL,

    -- Optional notes about the session (e.g., meeting context, goals)
    notes TEXT DEFAULT NULL,

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    -- Foreign key to hazop_analyses - cascade delete when analysis is deleted
    CONSTRAINT collaboration_sessions_fk_analysis FOREIGN KEY (analysis_id)
        REFERENCES hazop_analyses(id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Foreign key to users for creator - restrict deletion
    CONSTRAINT collaboration_sessions_fk_created_by FOREIGN KEY (created_by_id)
        REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Session name must not be empty when provided
    CONSTRAINT collaboration_sessions_name_not_empty CHECK (
        name IS NULL OR LENGTH(TRIM(name)) > 0
    ),

    -- Ended timestamp should only be set when status is 'ended'
    CONSTRAINT collaboration_sessions_ended_consistency CHECK (
        (status != 'ended' AND ended_at IS NULL) OR
        (status = 'ended' AND ended_at IS NOT NULL)
    )
);

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE collaboration_sessions IS
    'Real-time collaboration sessions for HazOps analyses. Enables multiple users '
    'to work together on the same analysis with live updates via WebSocket.';

COMMENT ON COLUMN collaboration_sessions.id IS
    'Unique identifier (UUID) for the collaboration session';

COMMENT ON COLUMN collaboration_sessions.analysis_id IS
    'Foreign key reference to the HazOps analysis being collaborated on';

COMMENT ON COLUMN collaboration_sessions.name IS
    'Optional name/title for the collaboration session';

COMMENT ON COLUMN collaboration_sessions.status IS
    'Current status: active (in progress), paused (temporarily stopped), ended (completed)';

COMMENT ON COLUMN collaboration_sessions.created_by_id IS
    'Foreign key reference to the user who initiated this collaboration session';

COMMENT ON COLUMN collaboration_sessions.created_at IS
    'Timestamp when the collaboration session was created';

COMMENT ON COLUMN collaboration_sessions.updated_at IS
    'Timestamp when the collaboration session was last updated';

COMMENT ON COLUMN collaboration_sessions.ended_at IS
    'Timestamp when the collaboration session ended (null if still active or paused)';

COMMENT ON COLUMN collaboration_sessions.notes IS
    'Optional notes about the session (meeting context, goals, etc.)';

-- ============================================================================
-- PERFORMANCE INDEXES FOR collaboration_sessions
-- ============================================================================

-- Index for querying sessions by analysis (most common query)
CREATE INDEX idx_collaboration_sessions_analysis_id
    ON collaboration_sessions (analysis_id);

-- Index for filtering by status (finding active sessions)
CREATE INDEX idx_collaboration_sessions_status
    ON collaboration_sessions (status);

-- Index for querying sessions by creator
CREATE INDEX idx_collaboration_sessions_created_by_id
    ON collaboration_sessions (created_by_id);

-- Composite index for analysis + status queries (finding active session for an analysis)
CREATE INDEX idx_collaboration_sessions_analysis_status
    ON collaboration_sessions (analysis_id, status);

-- Index for sorting by creation date
CREATE INDEX idx_collaboration_sessions_created_at
    ON collaboration_sessions (created_at DESC);

-- ============================================================================
-- SESSION_PARTICIPANTS TABLE
-- ============================================================================
-- Tracks users participating in collaboration sessions with their join/leave times.

CREATE TABLE session_participants (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to collaboration_sessions table
    session_id UUID NOT NULL,

    -- Foreign key to users table
    user_id UUID NOT NULL,

    -- Timestamp when user joined the session
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Timestamp when user left the session (null if still active)
    left_at TIMESTAMPTZ DEFAULT NULL,

    -- Whether the user is currently connected
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Last known cursor/focus position in the UI (stored as JSON for flexibility)
    -- Example: { "nodeId": "uuid", "entryId": "uuid", "field": "causes" }
    cursor_position JSONB DEFAULT NULL,

    -- Last activity timestamp (updated on each action)
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    -- Foreign key to collaboration_sessions - cascade delete when session is deleted
    CONSTRAINT session_participants_fk_session FOREIGN KEY (session_id)
        REFERENCES collaboration_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Foreign key to users - restrict deletion (users with session history cannot be deleted)
    CONSTRAINT session_participants_fk_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- A user can only have one active participation record per session
    -- (they can rejoin after leaving, creating a new record)
    CONSTRAINT session_participants_unique_active CHECK (
        is_active = FALSE OR left_at IS NULL
    ),

    -- Left timestamp should only be set when is_active is false
    CONSTRAINT session_participants_left_consistency CHECK (
        (is_active = TRUE AND left_at IS NULL) OR
        (is_active = FALSE)
    )
);

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE session_participants IS
    'Tracks users participating in real-time collaboration sessions. Records '
    'join/leave times and current cursor positions for presence awareness.';

COMMENT ON COLUMN session_participants.id IS
    'Unique identifier (UUID) for the participation record';

COMMENT ON COLUMN session_participants.session_id IS
    'Foreign key reference to the collaboration session';

COMMENT ON COLUMN session_participants.user_id IS
    'Foreign key reference to the participating user';

COMMENT ON COLUMN session_participants.joined_at IS
    'Timestamp when the user joined the collaboration session';

COMMENT ON COLUMN session_participants.left_at IS
    'Timestamp when the user left the session (null if still active)';

COMMENT ON COLUMN session_participants.is_active IS
    'Whether the user is currently connected to the session';

COMMENT ON COLUMN session_participants.cursor_position IS
    'JSON object storing the user''s current cursor/focus position in the UI';

COMMENT ON COLUMN session_participants.last_activity_at IS
    'Timestamp of the user''s last activity in the session';

-- ============================================================================
-- PERFORMANCE INDEXES FOR session_participants
-- ============================================================================

-- Index for querying participants by session (most common query)
CREATE INDEX idx_session_participants_session_id
    ON session_participants (session_id);

-- Index for querying sessions by user (user's collaboration history)
CREATE INDEX idx_session_participants_user_id
    ON session_participants (user_id);

-- Index for filtering active participants
CREATE INDEX idx_session_participants_is_active
    ON session_participants (is_active)
    WHERE is_active = TRUE;

-- Composite index for session + active participants (presence list)
CREATE INDEX idx_session_participants_session_active
    ON session_participants (session_id, is_active)
    WHERE is_active = TRUE;

-- Composite index for session + user (lookup specific user in session)
CREATE INDEX idx_session_participants_session_user
    ON session_participants (session_id, user_id);

-- Index for sorting by join time
CREATE INDEX idx_session_participants_joined_at
    ON session_participants (joined_at DESC);

-- Index for activity timeout detection
CREATE INDEX idx_session_participants_last_activity
    ON session_participants (last_activity_at)
    WHERE is_active = TRUE;
