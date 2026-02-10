-- Migration: 013_seed_admin_user
-- Description: Seed initial admin user for development
-- Date: 2026-02-09

-- Ensure we're using the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- SEED ADMIN USER
-- Email: admin@hazop.local
-- Password: Admin123!
-- Hashed with bcrypt (rounds: 10)
-- ============================================================================

-- Check if admin user already exists before inserting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@hazop.local') THEN
        INSERT INTO users (
            email,
            password_hash,
            name,
            role,
            organization,
            is_active
        ) VALUES (
            'admin@hazop.local',
            -- bcrypt hash for 'Admin123!' (10 rounds)
            '$2b$10$W54S9ku5zpcq0DTm7pILeOcYTNRIunMqwbISCubzAP27SEvEPiGFu',
            'System Administrator',
            'administrator',
            'HazOp Systems',
            TRUE
        );

        RAISE NOTICE 'Admin user created successfully';
    ELSE
        RAISE NOTICE 'Admin user already exists, skipping';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the admin user was created
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE email = 'admin@hazop.local';
    IF user_count = 1 THEN
        RAISE NOTICE 'Admin user verified: admin@hazop.local';
    ELSE
        RAISE WARNING 'Admin user verification failed!';
    END IF;
END $$;
