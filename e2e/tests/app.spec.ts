import { test, expect } from '@playwright/test';

test.describe('HazOp Assistant Application', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'HazOp Assistant' })).toBeVisible();
  });

  test('should display the description text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Industrial safety analysis platform')).toBeVisible();
  });

  test('should display the Get Started button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  });
});
