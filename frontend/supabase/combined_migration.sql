-- ============================================================================
-- COMBINED MIGRATION SCRIPT
-- This file combines all individual migration files in chronological order
-- ============================================================================

-- ============================================================================
-- Migration: 20251022_create_users_table.sql
-- Description: Create users table extending Supabase auth.users
-- ============================================================================

-- Create users table extending Supabase auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own data
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Only admins can read all users
CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Migration: 20251022_create_contacts_table.sql
-- Description: Create contacts table with full-text search and RLS
-- ============================================================================

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  status TEXT CHECK (status IN ('lead', 'customer')),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON public.contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_search ON public.contacts USING GIN(
  to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, ''))
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can create contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can read all contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can update all contacts" ON public.contacts;

-- RLS Policies
-- Users can read their own contacts
CREATE POLICY "Users can read own contacts"
  ON public.contacts
  FOR SELECT
  USING (auth.uid() = owner_id AND deleted_at IS NULL);

-- Users can create contacts (owner_id will be set automatically)
CREATE POLICY "Users can create contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts"
  ON public.contacts
  FOR UPDATE
  USING (auth.uid() = owner_id AND deleted_at IS NULL);

-- Admins can read all contacts
CREATE POLICY "Admins can read all contacts"
  ON public.contacts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all contacts
CREATE POLICY "Admins can update all contacts"
  ON public.contacts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Migration: 20251022_create_deals_table.sql
-- Description: Create deals table for deal pipeline management
-- ============================================================================

-- Create deals table for deal pipeline management
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  expected_close_date DATE,
  stage TEXT NOT NULL CHECK (stage IN ('lead', 'proposal', 'negotiation', 'closed-won', 'closed-lost')) DEFAULT 'lead',
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON public.deals(deleted_at);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can create deals" ON public.deals;
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
DROP POLICY IF EXISTS "Users can delete their own deals" ON public.deals;

-- RLS Policy: Users can see deals owned by them or created by their team
CREATE POLICY "Users can view their own deals"
ON public.deals FOR SELECT
USING (
  auth.uid() = owner_id OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- RLS Policy: Users can create deals
CREATE POLICY "Users can create deals"
ON public.deals FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- RLS Policy: Users can update their own deals
CREATE POLICY "Users can update their own deals"
ON public.deals FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- RLS Policy: Users can soft delete their own deals
CREATE POLICY "Users can delete their own deals"
ON public.deals FOR DELETE
USING (auth.uid() = owner_id);

-- ============================================================================
-- Migration: 20251022_create_activities_table.sql
-- Description: Create activities table for activity & task management
-- ============================================================================

-- Create activities table for activity & task management
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'task')),
  subject TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')) DEFAULT 'todo',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT activity_relation_check CHECK (contact_id IS NOT NULL OR deal_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_owner_id ON public.activities(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON public.activities(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_type ON public.activities(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_status ON public.activities(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON public.activities(due_date) WHERE deleted_at IS NULL AND status != 'completed';
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_deleted_at ON public.activities(deleted_at);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view activities for their contacts/deals" ON public.activities;
DROP POLICY IF EXISTS "Users can view assigned activities" ON public.activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
DROP POLICY IF EXISTS "Admins can view all activities" ON public.activities;

-- RLS Policy: Users can view activities for contacts/deals they own
CREATE POLICY "Users can view activities for their contacts/deals"
ON public.activities FOR SELECT
USING (
  deleted_at IS NULL AND (
    owner_id = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = activities.contact_id AND contacts.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.deals
      WHERE deals.id = activities.deal_id AND deals.owner_id = auth.uid()
    )
  )
);

-- RLS Policy: Users can create activities
CREATE POLICY "Users can create activities"
ON public.activities FOR INSERT
WITH CHECK (
  owner_id = auth.uid() AND
  (
    contact_id IN (SELECT id FROM public.contacts WHERE owner_id = auth.uid()) OR
    deal_id IN (SELECT id FROM public.deals WHERE owner_id = auth.uid())
  )
);

-- RLS Policy: Users can update their own activities or assigned tasks
CREATE POLICY "Users can update their own activities"
ON public.activities FOR UPDATE
USING (
  deleted_at IS NULL AND (
    owner_id = auth.uid() OR
    assigned_to = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid() OR
  assigned_to = auth.uid()
);

-- RLS Policy: Users can soft delete their own activities
CREATE POLICY "Users can delete their own activities"
ON public.activities FOR DELETE
USING (owner_id = auth.uid());

-- RLS Policy: Admins can view all activities
CREATE POLICY "Admins can view all activities"
ON public.activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_activities_updated_at ON public.activities;
CREATE TRIGGER set_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Migration: 20260204_create_time_entries_table.sql
-- Description: Create time_entries table for time tracking feature
-- ============================================================================

-- Create time_entries table for time tracking feature (Epic 5)
-- Tracks time spent on contacts, deals, and activities
-- Supports manual entry, timer-based tracking, and activity-linked entries
-- Includes billable hours tracking and approval workflow

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User who logged the time (required)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Related entities (at least one of contact_id or deal_id should be set)
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,

  -- Time tracking fields
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,

  -- Billable hours tracking
  is_billable BOOLEAN DEFAULT true,

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approval_notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, entry_date DESC);
CREATE INDEX idx_time_entries_contact ON time_entries(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_time_entries_deal ON time_entries(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_time_entries_status ON time_entries(status, user_id);
CREATE INDEX idx_time_entries_billable ON time_entries(is_billable, entry_date);
CREATE INDEX idx_time_entries_activity ON time_entries(activity_id) WHERE activity_id IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE time_entries IS 'Tracks time spent on contacts, deals, and activities with billable hours and approval workflow';
COMMENT ON COLUMN time_entries.status IS 'Workflow status: draft (default), submitted (awaiting approval), approved, rejected';
COMMENT ON COLUMN time_entries.is_billable IS 'Whether this time entry is billable to the client (default: true)';
COMMENT ON COLUMN time_entries.duration_minutes IS 'Duration in minutes (must be positive)';

-- ============================================================================
-- Migration: 20260204_create_time_entries_rls.sql
-- Description: Row Level Security policies for time_entries table
-- ============================================================================

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

-- ============================================================================
-- Migration: 20251022_fix_users_rls.sql
-- Description: Fix users table RLS policies to avoid recursion
-- ============================================================================

-- Drop ALL existing policies first to avoid "already exists" errors
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Now create the simplified policies (no admin policy to avoid recursion)
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- Migration: 20251023_admin_update_users_rls.sql
-- Description: Allow admins to update any user's data (including role)
-- ============================================================================

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

-- ============================================================================
-- Migration: 20251022_create_admin_user.sql
-- Description: Update test@example.com to be an admin for testing
-- ============================================================================

-- Update test@example.com to be an admin for testing purposes
UPDATE public.users
SET role = 'admin'
WHERE email = 'test@example.com';

-- ============================================================================
-- END OF COMBINED MIGRATION SCRIPT
-- ============================================================================
