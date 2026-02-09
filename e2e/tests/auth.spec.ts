import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication flows.
 *
 * These tests verify the complete login/logout user journey including:
 * - Login with valid credentials
 * - Logout and session termination
 * - Login form validation
 * - Error handling for invalid credentials
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

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test.describe('Login Page', () => {
    test('should display login form with all required elements', async ({ page }) => {
      await page.goto('/login');

      // Verify page heading
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

      // Verify form fields
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByLabel('Remember me')).toBeVisible();

      // Verify submit button
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

      // Verify navigation links
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Request access' })).toBeVisible();
    });

    test('should show validation error for empty email', async ({ page }) => {
      await page.goto('/login');

      // Fill only password, leave email empty
      await page.getByLabel('Password').fill('somepassword');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Should show validation error
      await expect(page.getByText('Email is required')).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      await page.goto('/login');

      // Fill invalid email
      await page.getByLabel('Email address').fill('notanemail');
      await page.getByLabel('Password').fill('somepassword');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Should show validation error
      await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    });

    test('should show validation error for empty password', async ({ page }) => {
      await page.goto('/login');

      // Fill only email, leave password empty
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Should show validation error
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      // Fill invalid credentials
      await page.getByLabel('Email address').fill('wrong@example.com');
      await page.getByLabel('Password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Wait for API response and error message
      // The exact error message may vary - check for any error alert
      await expect(page.locator('.mantine-Alert-root')).toBeVisible({ timeout: 10000 });
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: 'Forgot password?' }).click();

      await expect(page).toHaveURL('/forgot-password');
    });

    test('should navigate to registration page', async ({ page }) => {
      await page.goto('/login');

      await page.getByRole('link', { name: 'Request access' }).click();

      await expect(page).toHaveURL('/register');
    });
  });

  test.describe('Successful Login', () => {
    test('should login successfully with valid credentials and redirect to dashboard', async ({
      page,
    }) => {
      await page.goto('/login');

      // Fill valid credentials
      await page.getByLabel('Email address').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);

      // Submit form
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL('/', { timeout: 10000 });

      // Should display user's name on dashboard
      await expect(page.getByText(TEST_USER.name)).toBeVisible();

      // Should display HazOp Assistant heading
      await expect(page.getByRole('heading', { name: 'HazOp Assistant' })).toBeVisible();
    });

    test('should persist authentication across page reloads', async ({ page }) => {
      await page.goto('/login');

      // Login
      await page.getByLabel('Email address').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Wait for dashboard
      await expect(page).toHaveURL('/', { timeout: 10000 });

      // Reload page
      await page.reload();

      // Should still be on dashboard, not redirected to login
      await expect(page).toHaveURL('/');
      await expect(page.getByText(TEST_USER.name)).toBeVisible();
    });

    test('should redirect authenticated users away from login page', async ({ page }) => {
      await page.goto('/login');

      // Login first
      await page.getByLabel('Email address').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page).toHaveURL('/', { timeout: 10000 });

      // Try to navigate to login page
      await page.goto('/login');

      // Should be redirected back to dashboard
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      await page.goto('/login');
      await page.getByLabel('Email address').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/', { timeout: 10000 });
    });

    test('should logout successfully and redirect to login page', async ({ page }) => {
      // Click sign out button
      await page.getByRole('button', { name: 'Sign out' }).click();

      // Should redirect to login page
      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });

    test('should clear session data after logout', async ({ page }) => {
      // Verify we're logged in
      await expect(page.getByText(TEST_USER.name)).toBeVisible();

      // Logout
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL('/login', { timeout: 10000 });

      // Try to navigate to protected route
      await page.goto('/');

      // Should be redirected to login (not able to access dashboard)
      await expect(page).toHaveURL('/login');
    });

    test('should not be able to access protected routes after logout', async ({ page }) => {
      // Logout
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL('/login', { timeout: 10000 });

      // Try to access profile page
      await page.goto('/profile');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Clear any auth state
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());

      // Try to access dashboard directly
      await page.goto('/');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });

    test('should redirect unauthenticated users from profile to login', async ({ page }) => {
      // Clear any auth state
      await page.goto('/login');
      await page.evaluate(() => localStorage.clear());

      // Try to access profile directly
      await page.goto('/profile');

      // Should be redirected to login
      await expect(page).toHaveURL('/login');
    });
  });
});
