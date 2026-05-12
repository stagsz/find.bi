-- Check if user profile exists in public.users table
-- Run this in Supabase SQL Editor to see your users

SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.created_at
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
ORDER BY au.created_at DESC;

-- This will show:
-- - All authenticated users (from auth.users)
-- - Their profile data (from public.users)
-- - If profile is NULL, the trigger didn't work
