-- Create schema
CREATE SCHEMA IF NOT EXISTS hazop;

-- Set search path
SET search_path TO hazop, public;

-- Show confirmation
SELECT 'Schema created successfully' AS status;
