import { test, expect } from '@playwright/test'

test.describe('Epic 5: Manual Time Entry Flow', () => {
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

  test.describe('Story 5.6: Log Time button and modal on contact page', () => {
    test('should open Log Time modal when clicking + Log Time button', async ({ page }) => {
      // Navigate to contacts list
      await page.goto('/contacts')

      // Click on the first contact to go to detail page
      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Click the "+ Log Time" button
      await page.click('text=+ Log Time')

      // Modal should appear with the "Log Time Entry" heading
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Verify the form fields are present
      await expect(page.locator('#duration')).toBeVisible()
      await expect(page.locator('#entry_date')).toBeVisible()
      await expect(page.locator('#notes')).toBeVisible()
      await expect(page.locator('#is_billable')).toBeVisible()

      // Verify the form action buttons are present
      await expect(page.locator('button:has-text("Log Time")')).toBeVisible()
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible()
    })

    test('should close modal when clicking Cancel', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Click Cancel
      await page.click('button:has-text("Cancel")')

      // Modal should close
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible()
    })
  })

  test.describe('Story 5.7: Submit manual time entry on contact page', () => {
    test('should create a time entry with HH:MM duration format', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the Log Time modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Fill in the duration in HH:MM format
      await page.fill('#duration', '1:30')

      // Add notes
      await page.fill('#notes', 'E2E test - manual entry HH:MM format')

      // Billable should be checked by default
      await expect(page.locator('#is_billable')).toBeChecked()

      // Submit the form
      await page.click('button:has-text("Log Time")')

      // Modal should close after successful submission
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The time entry should appear in the Time Entries section
      // 1:30 = 1h 30m
      await expect(page.locator('text=1h 30m')).toBeVisible()

      // Notes should be visible
      await expect(page.locator('text=E2E test - manual entry HH:MM format')).toBeVisible()

      // Status should show as draft
      await expect(page.locator('text=draft').first()).toBeVisible()
    })

    test('should create a time entry with plain minutes duration', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the Log Time modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Fill in the duration as plain minutes
      await page.fill('#duration', '45')

      // Add notes
      await page.fill('#notes', 'E2E test - plain minutes format')

      // Submit the form
      await page.click('button:has-text("Log Time")')

      // Modal should close after successful submission
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The time entry should appear: 45 minutes = "45m"
      await expect(page.locator('text=45m')).toBeVisible()
    })

    test('should create a non-billable time entry', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the Log Time modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Fill in duration
      await page.fill('#duration', '20')

      // Uncheck billable
      await page.uncheck('#is_billable')
      await expect(page.locator('#is_billable')).not.toBeChecked()

      // Add notes
      await page.fill('#notes', 'E2E test - non-billable entry')

      // Submit the form
      await page.click('button:has-text("Log Time")')

      // Modal should close
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The entry should appear
      await expect(page.locator('text=20m')).toBeVisible()
      await expect(page.locator('text=E2E test - non-billable entry')).toBeVisible()
    })

    test('should show validation error for invalid duration', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the Log Time modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Fill in an invalid duration
      await page.fill('#duration', 'abc')

      // Validation error should appear
      await expect(page.locator('text=Enter a valid duration')).toBeVisible()

      // The Log Time submit button should still be present (modal should not close)
      await expect(page.locator('button:has-text("Log Time")')).toBeVisible()
    })
  })

  test.describe('Story 5.8: Log Time on deal page', () => {
    test('should open Log Time modal and create entry on deal page', async ({ page }) => {
      // Navigate to deals list
      await page.goto('/deals')

      // Click on the first deal
      const dealLink = page.locator('table tbody tr a, [data-testid="deal-row"] a, a[href*="/deals/"]').first()
      await dealLink.click()

      await page.waitForURL(/\/deals\/[^/]+$/)

      // Click the "+ Log Time" button
      await page.click('text=+ Log Time')

      // Modal should appear
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Fill in the form
      await page.fill('#duration', '2:00')
      await page.fill('#notes', 'E2E test - deal time entry')

      // Submit the form
      await page.click('button:has-text("Log Time")')

      // Modal should close
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The time entry should appear: 2:00 = 2h
      await expect(page.locator('text=2h')).toBeVisible()

      // Notes should be visible
      await expect(page.locator('text=E2E test - deal time entry')).toBeVisible()
    })
  })

  test.describe('Story 5.9: Edit draft time entry', () => {
    test('should open edit modal when clicking a draft time entry', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // First create a time entry so we have one to edit
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()
      await page.fill('#duration', '30')
      await page.fill('#notes', 'E2E test - to be edited')
      await page.click('button:has-text("Log Time")')
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // Wait for the entry to appear
      await expect(page.locator('text=30m')).toBeVisible()

      // Click on the draft entry to edit it (entries with draft status are clickable)
      const draftEntry = page.locator('text=E2E test - to be edited')
      await draftEntry.click()

      // The edit modal should appear
      await expect(page.locator('text=Edit Time Entry')).toBeVisible()

      // The form should be pre-populated
      await expect(page.locator('#duration')).toHaveValue('0:30')

      // Update the duration
      await page.fill('#duration', '1:00')

      // Submit the updated entry
      await page.click('button:has-text("Update Entry")')

      // Edit modal should close
      await expect(page.locator('text=Edit Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The updated duration should appear: 1:00 = 1h
      await expect(page.locator('text=1h').first()).toBeVisible()
    })
  })

  test.describe('Story 5.10: Billable checkbox defaults', () => {
    test('should have billable checkbox checked by default in create mode', async ({ page }) => {
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Open the Log Time modal
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      // Billable checkbox should be checked by default
      await expect(page.locator('#is_billable')).toBeChecked()
    })
  })
})
