-- ============================================================================
-- CLEANUP SCRIPT
-- This script drops all CRM tables and related objects
-- Use this to start fresh before running the combined_migration.sql
-- ============================================================================

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop triggers (these should be dropped with CASCADE, but just in case)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Note: This will remove all data from these tables!
-- Make sure you have backups if you need the data.
