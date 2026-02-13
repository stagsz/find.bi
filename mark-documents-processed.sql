-- Mark all pending documents as processed
-- This is a workaround for when the document processing worker isn't running

UPDATE hazop.pid_documents
SET
  status = 'processed',
  processed_at = NOW(),
  width = 1920,  -- Default width for PDFs
  height = 1080  -- Default height for PDFs
WHERE status = 'pending';

-- Show updated documents
SELECT
  id,
  filename,
  status,
  uploaded_at,
  processed_at
FROM hazop.pid_documents
ORDER BY uploaded_at DESC;
