import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * E2E tests for P&ID upload workflow.
 *
 * These tests verify the complete P&ID document upload journey including:
 * - File upload via click-to-browse
 * - File validation (type and size)
 * - Successful upload flow
 * - Document list display after upload
 * - Document deletion
 *
 * Prerequisites:
 * - Database must have the seeded admin user (admin@hazop.local / Admin123!)
 * - Run migration: migrations/013_seed_admin_user.sql
 */

// Test user credentials (from seed migration)
const TEST_USER = {
  email: 'admin@hazop.local',
  password: 'Admin123!',
  name: 'System Administrator',
};

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

// Minimal valid PNG (1x1 pixel) as base64
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Minimal valid JPEG (1x1 pixel) as base64
const JPG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR' +
  'CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAA' +
  'AAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMB' +
  'AAIRAxEAPwCwAB//2Q==';

/**
 * Helper function to log in the test user.
 */
async function loginTestUser(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.getByLabel('Email address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

/**
 * Generate a unique project name for testing.
 */
function generateProjectName(): string {
  return `Upload Test Project ${Date.now()}`;
}

/**
 * Create a new project and navigate to its documents tab.
 * Returns the project ID from the URL.
 */
async function createProjectAndGoToDocuments(page: Page): Promise<string> {
  const projectName = generateProjectName();

  // Navigate to projects page
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  // Create a new project
  await page.getByRole('button', { name: 'New Project' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByPlaceholder('Enter project name').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();

  // Wait for modal to close and project to appear
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

  // Navigate to project detail page
  const projectRow = page.locator('tr').filter({ hasText: projectName });
  await projectRow.getByRole('button', { name: 'View' }).click();

  // Wait for project detail page to load
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/, { timeout: 10000 });

  // Extract project ID from URL
  const url = page.url();
  const projectId = url.split('/projects/')[1];

  // Click on Documents tab
  await page.getByRole('tab', { name: 'Documents' }).click();

  // Wait for documents section to load
  await expect(page.getByText('Upload P&ID Document')).toBeVisible();

  return projectId;
}

/**
 * Create test fixtures in the fixtures directory.
 */
function ensureTestFixtures(): void {
  // Ensure fixtures directory exists
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // Create PNG test file from base64
  const testPngPath = path.join(FIXTURES_DIR, 'test-pid.png');
  if (!fs.existsSync(testPngPath)) {
    fs.writeFileSync(testPngPath, Buffer.from(PNG_BASE64, 'base64'));
  }

  // Create JPG test file from base64
  const testJpgPath = path.join(FIXTURES_DIR, 'test-pid.jpg');
  if (!fs.existsSync(testJpgPath)) {
    fs.writeFileSync(testJpgPath, Buffer.from(JPG_BASE64, 'base64'));
  }

  // Create a simple text file (invalid type for P&ID)
  const testTxtPath = path.join(FIXTURES_DIR, 'test-invalid.txt');
  if (!fs.existsSync(testTxtPath)) {
    fs.writeFileSync(testTxtPath, 'This is not a valid P&ID file');
  }
}

test.describe('P&ID Upload Workflow', () => {
  // Set up test fixtures before all tests
  test.beforeAll(() => {
    ensureTestFixtures();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginTestUser(page);
  });

  test.describe('Upload Component Display', () => {
    test('should display upload area with correct elements', async ({ page }) => {
      // Create a project and go to Documents tab
      await createProjectAndGoToDocuments(page);

      // Verify upload section header
      await expect(page.getByText('Upload P&ID Document')).toBeVisible();

      // Verify upload zone is visible with instructions
      await expect(page.getByText('Click to upload')).toBeVisible();
      await expect(page.getByText('or drag and drop')).toBeVisible();
      await expect(page.getByText('PDF, PNG, JPG, or DWG up to 50MB')).toBeVisible();

      // Verify documents section
      await expect(page.getByText('Documents')).toBeVisible();
      await expect(page.getByText('No documents yet')).toBeVisible();
    });

    test('should display empty state message when no documents exist', async ({ page }) => {
      // Create a project and go to Documents tab
      await createProjectAndGoToDocuments(page);

      // Verify empty state
      await expect(page.getByText('No documents yet')).toBeVisible();
      await expect(page.getByText('Upload a P&ID document to get started')).toBeVisible();
    });
  });

  test.describe('File Selection', () => {
    test('should show file preview after selecting a PNG file', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select a PNG file using file input
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file preview is shown
      await expect(page.getByText('test-pid.png')).toBeVisible();

      // Verify Upload and Remove buttons appear
      await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    });

    test('should show file preview after selecting a JPG file', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select a JPG file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.jpg');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file preview is shown
      await expect(page.getByText('test-pid.jpg')).toBeVisible();

      // Verify Upload button appears
      await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
    });

    test('should clear file selection when Remove button is clicked', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select a file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file is selected
      await expect(page.getByText('test-pid.png')).toBeVisible();

      // Click Remove button
      await page.getByRole('button', { name: 'Remove' }).click();

      // Verify file preview is gone and upload zone is back
      await expect(page.getByText('test-pid.png')).not.toBeVisible();
      await expect(page.getByText('Click to upload')).toBeVisible();
    });
  });

  test.describe('File Validation', () => {
    test('should show error for invalid file type', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Try to select a text file (invalid type)
      const testFilePath = path.join(FIXTURES_DIR, 'test-invalid.txt');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify validation error is shown
      await expect(page.getByText('Invalid file type')).toBeVisible();
      await expect(page.getByText('Supported formats: PDF, PNG, JPG, DWG')).toBeVisible();

      // Verify Upload button is NOT shown (file was rejected)
      await expect(page.getByRole('button', { name: 'Upload' })).not.toBeVisible();
    });
  });

  test.describe('Successful Upload', () => {
    test('should upload PNG file successfully', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select a PNG file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file is selected
      await expect(page.getByText('test-pid.png')).toBeVisible();

      // Click Upload button
      await page.getByRole('button', { name: 'Upload' }).click();

      // Wait for success message
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify document appears in the list
      await expect(page.locator('table').getByText('test-pid.png')).toBeVisible({
        timeout: 10000,
      });
    });

    test('should upload JPG file successfully', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select a JPG file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.jpg');
      await page.setInputFiles('input[type="file"]', testFilePath);

      // Verify file is selected
      await expect(page.getByText('test-pid.jpg')).toBeVisible();

      // Click Upload button
      await page.getByRole('button', { name: 'Upload' }).click();

      // Wait for success message
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify document appears in the list
      await expect(page.locator('table').getByText('test-pid.jpg')).toBeVisible({
        timeout: 10000,
      });
    });

    test('should show document status badge after upload', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select and upload a file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();

      // Wait for success
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify the document row has a status badge (Pending or Processing)
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await expect(documentRow).toBeVisible({ timeout: 10000 });

      // Status should be one of: Pending, Processing, Processed
      const statusCell = documentRow.locator('text=/Pending|Processing|Processed/');
      await expect(statusCell).toBeVisible();
    });

    test('should display uploader name after upload', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Select and upload a file
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();

      // Wait for success
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify the document row shows the uploader name
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await expect(documentRow).toBeVisible({ timeout: 10000 });
      await expect(documentRow.getByText(TEST_USER.name)).toBeVisible();
    });

    test('should allow uploading multiple files sequentially', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload first file
      const pngPath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', pngPath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Close success alert
      await page.locator('.mantine-Alert-root').getByRole('button').first().click();
      await expect(page.getByText('Document uploaded successfully')).not.toBeVisible();

      // Upload second file
      const jpgPath = path.join(FIXTURES_DIR, 'test-pid.jpg');
      await page.setInputFiles('input[type="file"]', jpgPath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify both documents are in the list
      await expect(page.locator('table').getByText('test-pid.png')).toBeVisible();
      await expect(page.locator('table').getByText('test-pid.jpg')).toBeVisible();
    });
  });

  test.describe('Document List Features', () => {
    test('should show download button for uploaded documents', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify Download button exists in the document row
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await expect(documentRow.getByRole('button', { name: 'Download' })).toBeVisible();
    });

    test('should show delete button for uploaded documents', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Verify Delete button exists in the document row
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await expect(documentRow.getByRole('button', { name: 'Delete' })).toBeVisible();
    });

    test('should search documents by filename', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Search for the document
      await page.getByPlaceholder('Search by filename...').fill('test-pid');

      // Verify document is found
      await expect(page.locator('table').getByText('test-pid.png')).toBeVisible({
        timeout: 5000,
      });

      // Search for something that doesn't exist
      await page.getByPlaceholder('Search by filename...').fill('nonexistent');

      // Verify no results message
      await expect(page.getByText('No documents match your filters')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should reset filters when Reset button is clicked', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Apply a search filter
      await page.getByPlaceholder('Search by filename...').fill('nonexistent');
      await expect(page.getByText('No documents match your filters')).toBeVisible({
        timeout: 5000,
      });

      // Click Reset button
      await page.getByRole('button', { name: 'Reset' }).click();

      // Verify search is cleared and document is visible
      await expect(page.getByPlaceholder('Search by filename...')).toHaveValue('');
      await expect(page.locator('table').getByText('test-pid.png')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Document Deletion', () => {
    test('should delete document after confirmation', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Close success alert
      await page.locator('.mantine-Alert-root').getByRole('button').first().click();

      // Click Delete button
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await documentRow.getByRole('button', { name: 'Delete' }).click();

      // Verify confirmation modal appears
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Delete Document')).toBeVisible();
      await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
      await expect(page.getByText('test-pid.png', { exact: false })).toBeVisible();

      // Confirm deletion
      await page.getByRole('button', { name: 'Delete Document' }).click();

      // Wait for modal to close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

      // Verify document is removed from list
      await expect(page.locator('table').getByText('test-pid.png')).not.toBeVisible({
        timeout: 10000,
      });
    });

    test('should cancel deletion when Cancel button is clicked', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Upload a file first
      const testFilePath = path.join(FIXTURES_DIR, 'test-pid.png');
      await page.setInputFiles('input[type="file"]', testFilePath);
      await page.getByRole('button', { name: 'Upload' }).click();
      await expect(page.getByText('Document uploaded successfully')).toBeVisible({
        timeout: 30000,
      });

      // Close success alert
      await page.locator('.mantine-Alert-root').getByRole('button').first().click();

      // Click Delete button
      const documentRow = page.locator('table tr').filter({ hasText: 'test-pid.png' });
      await documentRow.getByRole('button', { name: 'Delete' }).click();

      // Verify confirmation modal appears
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Verify modal is closed
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Verify document is still in list
      await expect(page.locator('table').getByText('test-pid.png')).toBeVisible();
    });
  });

  test.describe('Upload Zone Interactions', () => {
    test('should have keyboard accessible upload zone', async ({ page }) => {
      await createProjectAndGoToDocuments(page);

      // Verify the upload zone has proper ARIA attributes
      const uploadZone = page.locator('[aria-label="Upload P&ID document"]');
      await expect(uploadZone).toBeVisible();

      // Tab to upload zone and verify it can be focused
      await uploadZone.focus();
      await expect(uploadZone).toBeFocused();
    });
  });
});
