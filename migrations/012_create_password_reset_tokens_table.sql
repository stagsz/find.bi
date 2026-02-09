-- Migration: 012_create_password_reset_tokens_table
-- Description: Create password reset tokens table for forgot password flow
-- Task: AUTH-12
-- Date: 2026-02-09

-- Ensure we're using the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- PASSWORD RESET TOKENS TABLE
-- Stores tokens for password reset flow with expiration
-- ============================================================================

CREATE TABLE password_reset_tokens (
    -- Primary key using UUID
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to user requesting reset
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Token hash (we store hash, not plain token for security)
    token_hash VARCHAR(255) NOT NULL,

    -- Expiration timestamp (tokens should be short-lived)
    expires_at TIMESTAMPTZ NOT NULL,

    -- Whether token has been used (single-use tokens)
    used_at TIMESTAMPTZ DEFAULT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens for forgot password flow';
COMMENT ON COLUMN password_reset_tokens.id IS 'Unique identifier (UUID v4)';
COMMENT ON COLUMN password_reset_tokens.user_id IS 'Reference to user requesting password reset';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (plain token sent via email)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Timestamp when the token expires (typically 1 hour)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (null if unused)';
COMMENT ON COLUMN password_reset_tokens.created_at IS 'Timestamp when the token was created';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for looking up tokens by user (to invalidate old tokens)
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);

-- Index for finding valid tokens (not expired, not used)
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at) WHERE used_at IS NULL;

-- ============================================================================
-- CLEANUP FUNCTION
-- Periodically delete expired tokens (can be called via pg_cron or app logic)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < NOW() OR used_at IS NOT NULL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_password_reset_tokens() IS 'Remove expired or used password reset tokens';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- To verify the table was created:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'hazop' AND table_name = 'password_reset_tokens';
