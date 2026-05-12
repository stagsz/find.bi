-- Allow admins to update any user's data (including role)
-- This policy enables admins to change user roles from the admin panel

CREATE POLICY "Admins can update any user"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
