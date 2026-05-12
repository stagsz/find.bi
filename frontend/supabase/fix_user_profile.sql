-- Fix missing user profiles
-- This creates profiles for any auth.users that don't have one in public.users

INSERT INTO public.users (id, email, full_name, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'admin'  -- Change to 'user' if you don't want admin access
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL  -- Only insert if profile doesn't exist
ON CONFLICT (id) DO NOTHING;

-- Verify it worked
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role
FROM public.users u;
