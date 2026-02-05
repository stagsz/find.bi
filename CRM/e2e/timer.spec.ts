import { test, expect } from '@playwright/test'

test.describe('Epic 5: Timer Flow', () => {
  // Setup: Login before each test and clear timer state
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')

    // Fill in credentials
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for successful login
    await page.waitForURL('/')

    // Clear any persisted timer state from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('crm-timer-state')
    })
  })

  test.describe('Story 5.1: Timer display on contact page', () => {
    test('should display timer component on contact detail page', async ({ page }) => {
      // Navigate to contacts list
      await page.goto('/contacts')

      // Click on the first contact to go to detail page
      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        // Fallback: look for any contact link in the page
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      // Wait for contact detail page to load
      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Verify the Time Tracking section is visible
      await expect(page.locator('text=Time Tracking')).toBeVisible()

      // Verify the Session Timer label is visible
      await expect(page.locator('text=Session Timer')).toBeVisible()

      // Verify the timer display shows 00:00:00
      await expect(page.locator('text=00:00:00')).toBeVisible()

      // Verify the Start button is visible
      await expect(page.locator('button[aria-label="Start timer"]')).toBeVisible()
    })

    test('should display Log Time button on contact detail page', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Verify the Log Time button is visible
      await expect(page.locator('text=+ Log Time')).toBeVisible()
    })
  })

  test.describe('Story 5.2: Start and stop timer', () => {
    test('should start timer and show running state', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Click Start button
      await page.click('button[aria-label="Start timer"]')

      // Wait a moment for state to update
      await page.waitForTimeout(1500)

      // Timer should now show running indicator
      await expect(page.locator('text=Timer running...')).toBeVisible()

      // Stop button should be visible (replaces Start)
      await expect(page.locator('button[aria-label="Stop timer"]')).toBeVisible()

      // Start button should no longer be visible
      await expect(page.locator('button[aria-label="Start timer"]')).not.toBeVisible()
    })

    test('should stop timer and show elapsed time', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Start the timer
      await page.click('button[aria-label="Start timer"]')

      // Wait for timer to accumulate a few seconds
      await page.waitForTimeout(3000)

      // Stop the timer
      await page.click('button[aria-label="Stop timer"]')

      // Running indicator should disappear
      await expect(page.locator('text=Timer running...')).not.toBeVisible()

      // Timer should show elapsed time (not 00:00:00 anymore)
      await expect(page.locator('text=00:00:00')).not.toBeVisible()

      // Start button should be visible again
      await expect(page.locator('button[aria-label="Start timer"]')).toBeVisible()

      // Reset button should also be visible (since elapsed > 0)
      await expect(page.locator('button[aria-label="Reset timer"]')).toBeVisible()
    })

    test('should reset timer back to zero', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Start and stop the timer
      await page.click('button[aria-label="Start timer"]')
      await page.waitForTimeout(2000)
      await page.click('button[aria-label="Stop timer"]')

      // Reset the timer
      await page.click('button[aria-label="Reset timer"]')

      // Timer should show 00:00:00 again
      await expect(page.locator('text=00:00:00')).toBeVisible()

      // Reset button should not be visible (elapsed is 0)
      await expect(page.locator('button[aria-label="Reset timer"]')).not.toBeVisible()
    })
  })

  test.describe('Story 5.3: Timer persistence across page navigation', () => {
    test('should persist timer state when navigating away and back', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      // Get current URL for navigating back
      const contactUrl = page.url()

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Start the timer
      await page.click('button[aria-label="Start timer"]')
      await page.waitForTimeout(2000)

      // Navigate away (to contacts list)
      await page.goto('/contacts')
      await page.waitForURL('/contacts')

      // Navigate back to the contact
      await page.goto(contactUrl)
      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Timer should still be running (show running indicator)
      await expect(page.locator('text=Timer running...')).toBeVisible()

      // Stop button should be visible
      await expect(page.locator('button[aria-label="Stop timer"]')).toBeVisible()

      // Clean up: stop the timer
      await page.click('button[aria-label="Stop timer"]')
    })
  })

  test.describe('Story 5.4: Timer on deal detail page', () => {
    test('should display timer component on deal detail page', async ({ page }) => {
      // Navigate to deals list
      await page.goto('/deals')

      // Click on the first deal to go to detail page
      const dealLink = page.locator('table tbody tr a, [data-testid="deal-row"] a, a[href*="/deals/"]').first()
      await dealLink.click()

      // Wait for deal detail page to load
      await page.waitForURL(/\/deals\/[^/]+$/)

      // Verify the Session Timer label is visible
      await expect(page.locator('text=Session Timer')).toBeVisible()

      // Verify the timer display shows 00:00:00
      await expect(page.locator('text=00:00:00')).toBeVisible()

      // Verify the Start button is visible
      await expect(page.locator('button[aria-label="Start timer"]')).toBeVisible()
    })

    test('should start and stop timer on deal page', async ({ page }) => {
      await page.goto('/deals')

      const dealLink = page.locator('table tbody tr a, [data-testid="deal-row"] a, a[href*="/deals/"]').first()
      await dealLink.click()

      await page.waitForURL(/\/deals\/[^/]+$/)

      // Start the timer
      await page.click('button[aria-label="Start timer"]')
      await page.waitForTimeout(2000)

      // Verify running state
      await expect(page.locator('text=Timer running...')).toBeVisible()
      await expect(page.locator('button[aria-label="Stop timer"]')).toBeVisible()

      // Stop the timer
      await page.click('button[aria-label="Stop timer"]')

      // Verify stopped state
      await expect(page.locator('text=Timer running...')).not.toBeVisible()
      await expect(page.locator('button[aria-label="Start timer"]')).toBeVisible()
    })
  })

  test.describe('Story 5.5: Single timer constraint', () => {
    test('should show switch option when timer running on different entity', async ({ page }) => {
      // Start timer on a contact
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Start the timer on this contact
      await page.click('button[aria-label="Start timer"]')
      await page.waitForTimeout(1500)

      // Verify timer is running here
      await expect(page.locator('text=Timer running...')).toBeVisible()

      // Now navigate to a deal
      await page.goto('/deals')

      const dealLink = page.locator('table tbody tr a, [data-testid="deal-row"] a, a[href*="/deals/"]').first()
      await dealLink.click()

      await page.waitForURL(/\/deals\/[^/]+$/)

      // Timer should show "running on another" indicator since it's running on a contact
      await expect(page.locator('text=Timer running on another')).toBeVisible()

      // Switch button should be visible instead of Start
      await expect(page.locator('button[aria-label="Switch timer to here"]')).toBeVisible()
      await expect(page.locator('button[aria-label="Start timer"]')).not.toBeVisible()
    })

    test('should switch timer to current entity', async ({ page }) => {
      // Start timer on a contact
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Start the timer on this contact
      await page.click('button[aria-label="Start timer"]')
      await page.waitForTimeout(1500)

      // Navigate to a deal
      await page.goto('/deals')

      const dealLink = page.locator('table tbody tr a, [data-testid="deal-row"] a, a[href*="/deals/"]').first()
      await dealLink.click()

      await page.waitForURL(/\/deals\/[^/]+$/)

      // Click Switch to move the timer here
      await page.click('button[aria-label="Switch timer to here"]')
      await page.waitForTimeout(1500)

      // Timer should now be running on this deal
      await expect(page.locator('text=Timer running...')).toBeVisible()
      await expect(page.locator('button[aria-label="Stop timer"]')).toBeVisible()

      // Clean up
      await page.click('button[aria-label="Stop timer"]')
    })
  })
})
