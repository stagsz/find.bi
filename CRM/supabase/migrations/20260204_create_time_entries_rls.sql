-- Row Level Security (RLS) policies for time_entries table
-- Users can see and manage their own time entries
-- Admins can see and manage all time entries

-- Enable RLS on time_entries table
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own time entries
CREATE POLICY "Users can view own time entries"
  ON time_entries
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    -- Admins can view all time entries
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Users can insert their own time entries
CREATE POLICY "Users can create own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy: Users can update their own draft or submitted time entries
-- Approved time entries can only be updated by admins
CREATE POLICY "Users can update own time entries"
  ON time_entries
  FOR UPDATE
  USING (
    -- User owns the entry and it's not approved
    (auth.uid() = user_id AND status IN ('draft', 'submitted'))
    OR
    -- Admins can update any entry (including approval)
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Users can delete their own draft time entries
-- Admins can delete any time entry
CREATE POLICY "Users can delete own draft entries"
  ON time_entries
  FOR DELETE
  USING (
    (auth.uid() = user_id AND status = 'draft')
    OR
    -- Admins can delete any entry
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Users can view own time entries" ON time_entries IS 'Users see their own entries, admins see all';
COMMENT ON POLICY "Users can create own time entries" ON time_entries IS 'Users can only create entries for themselves';
COMMENT ON POLICY "Users can update own time entries" ON time_entries IS 'Users can update draft/submitted entries, admins can update any';
COMMENT ON POLICY "Users can delete own draft entries" ON time_entries IS 'Users can only delete their own drafts, admins can delete any';
