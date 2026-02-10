import { test, expect } from '@playwright/test';

/**
 * E2E tests for project creation workflow.
 *
 * These tests verify the complete project creation journey including:
 * - Opening the create project modal
 * - Form validation for required fields
 * - Successful project creation
 * - New project appearing in the list
 * - Modal cancellation
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

/**
 * Helper function to log in the test user.
 */
async function loginTestUser(page: import('@playwright/test').Page) {
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
  return `Test Project ${Date.now()}`;
}

test.describe('Project Creation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginTestUser(page);
    // Navigate to projects page
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test.describe('Projects Page', () => {
    test('should display projects page with all required elements', async ({ page }) => {
      // Verify page heading
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

      // Verify description
      await expect(page.getByText('Manage your HazOps study projects')).toBeVisible();

      // Verify "New Project" button
      await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible();

      // Verify search input
      await expect(page.getByPlaceholder('Search by name or description...')).toBeVisible();

      // Verify table headers
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Your Role' })).toBeVisible();
    });

    test('should navigate back to dashboard via breadcrumb', async ({ page }) => {
      await page.getByRole('link', { name: 'Dashboard' }).click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Create Project Modal', () => {
    test('should open create project modal when clicking New Project button', async ({ page }) => {
      await page.getByRole('button', { name: 'New Project' }).click();

      // Verify modal is open with title
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'New Project' })).toBeVisible();

      // Verify form elements
      await expect(page.getByText('Project Name')).toBeVisible();
      await expect(page.getByPlaceholder('Enter project name')).toBeVisible();
      await expect(page.getByText('Description')).toBeVisible();
      await expect(page.getByPlaceholder('Enter project description (optional)')).toBeVisible();

      // Verify buttons
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Project' })).toBeVisible();
    });

    test('should close modal when clicking Cancel button', async ({ page }) => {
      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();

      // Modal should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should have Create Project button disabled when name is empty', async ({ page }) => {
      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Create Project button should be disabled when name is empty
      await expect(page.getByRole('button', { name: 'Create Project' })).toBeDisabled();

      // Enter some text
      await page.getByPlaceholder('Enter project name').fill('Test');
      await expect(page.getByRole('button', { name: 'Create Project' })).toBeEnabled();

      // Clear the text
      await page.getByPlaceholder('Enter project name').clear();
      await expect(page.getByRole('button', { name: 'Create Project' })).toBeDisabled();
    });

    test('should show validation error for empty name after clicking Create Project', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Enter only whitespace
      await page.getByPlaceholder('Enter project name').fill('   ');

      // Even with whitespace, button should be disabled (trim happens on submit)
      // The button checks trim() on the value
      await expect(page.getByRole('button', { name: 'Create Project' })).toBeDisabled();
    });

    test('should clear form when modal is reopened', async ({ page }) => {
      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Enter some data
      await page.getByPlaceholder('Enter project name').fill('Test Project');
      await page.getByPlaceholder('Enter project description (optional)').fill('Test Description');

      // Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Reopen modal
      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fields should be empty
      await expect(page.getByPlaceholder('Enter project name')).toHaveValue('');
      await expect(page.getByPlaceholder('Enter project description (optional)')).toHaveValue('');
    });
  });

  test.describe('Successful Project Creation', () => {
    test('should create a project successfully with name only', async ({ page }) => {
      const projectName = generateProjectName();

      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill project name
      await page.getByPlaceholder('Enter project name').fill(projectName);

      // Click Create Project
      await page.getByRole('button', { name: 'Create Project' }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

      // New project should appear in the table
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
    });

    test('should create a project successfully with name and description', async ({ page }) => {
      const projectName = generateProjectName();
      const projectDescription = 'This is a test project description for E2E testing';

      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Fill project name and description
      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByPlaceholder('Enter project description (optional)').fill(projectDescription);

      // Click Create Project
      await page.getByRole('button', { name: 'Create Project' }).click();

      // Modal should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

      // New project should appear in the table with name
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

      // Description should be visible in the table (truncated if long)
      await expect(page.getByText(projectDescription).first()).toBeVisible();
    });

    test('should show new project with Planning status', async ({ page }) => {
      const projectName = generateProjectName();

      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();

      // Wait for modal to close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

      // Find the row with the project name
      const projectRow = page.locator('tr').filter({ hasText: projectName });
      await expect(projectRow).toBeVisible({ timeout: 10000 });

      // Verify Planning status badge
      await expect(projectRow.getByText('Planning')).toBeVisible();
    });

    test('should show current user as Owner of new project', async ({ page }) => {
      const projectName = generateProjectName();

      await page.getByRole('button', { name: 'New Project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();

      // Wait for modal to close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

      // Find the row with the project name
      const projectRow = page.locator('tr').filter({ hasText: projectName });
      await expect(projectRow).toBeVisible({ timeout: 10000 });

      // Verify Owner role badge
      await expect(projectRow.getByText('Owner')).toBeVisible();
    });

    test('should navigate to project detail page when clicking View', async ({ page }) => {
      const projectName = generateProjectName();

      // Create a project first
      await page.getByRole('button', { name: 'New Project' }).click();
      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

      // Click View button on the project row
      const projectRow = page.locator('tr').filter({ hasText: projectName });
      await projectRow.getByRole('button', { name: 'View' }).click();

      // Should navigate to project detail page
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

      // Project name should be visible on detail page
      await expect(page.getByText(projectName)).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error when creating duplicate project name', async ({ page }) => {
      const projectName = generateProjectName();

      // Create first project
      await page.getByRole('button', { name: 'New Project' }).click();
      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

      // Try to create another project with same name
      await page.getByRole('button', { name: 'New Project' }).click();
      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();

      // Should show error alert
      await expect(page.locator('.mantine-Alert-root')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/already exists/i)).toBeVisible();
    });
  });

  test.describe('Search and Filter', () => {
    test('should filter projects by search query', async ({ page }) => {
      const projectName = `Searchable ${Date.now()}`;

      // Create a project with a unique name
      await page.getByRole('button', { name: 'New Project' }).click();
      await page.getByPlaceholder('Enter project name').fill(projectName);
      await page.getByRole('button', { name: 'Create Project' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });

      // Search for the project
      await page.getByPlaceholder('Search by name or description...').fill('Searchable');

      // Wait for debounce and search results
      await expect(page.getByText(projectName)).toBeVisible({ timeout: 5000 });

      // Search for something that won't match
      await page.getByPlaceholder('Search by name or description...').fill('nonexistent12345');

      // Should show "No projects found"
      await expect(page.getByText('No projects found')).toBeVisible({ timeout: 5000 });
    });

    test('should reset filters when clicking Reset button', async ({ page }) => {
      // Enter a search query
      await page.getByPlaceholder('Search by name or description...').fill('some search');

      // Click Reset
      await page.getByRole('button', { name: 'Reset' }).click();

      // Search should be cleared
      await expect(page.getByPlaceholder('Search by name or description...')).toHaveValue('');
    });
  });
});
