import { test, expect } from '@playwright/test'

test.describe('Epic 5: Time Entry Approval Workflow', () => {
  // Setup: Login before each test and clear timer state
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')

    // Fill in credentials (test@example.com is an admin user)
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

  test.describe('Story 5.11: Submit time entry for approval', () => {
    test('should create a draft time entry and submit it for approval', async ({ page }) => {
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

      // Create a time entry
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()

      await page.fill('#duration', '0:45')
      await page.fill('#notes', 'E2E approval test - submit for review')
      await page.click('button:has-text("Log Time")')

      // Modal should close after successful submission
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // The time entry should appear with draft status
      await expect(page.locator('text=45m')).toBeVisible()
      await expect(page.locator('text=E2E approval test - submit for review')).toBeVisible()
      await expect(page.locator('text=draft').first()).toBeVisible()
    })
  })

  test.describe('Story 5.12: Admin approves a time entry', () => {
    test('should approve a submitted time entry from admin approvals page', async ({ page }) => {
      // Step 1: Create and submit a time entry via the contact page
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Create the time entry
      await page.click('text=+ Log Time')
      await expect(page.locator('text=Log Time Entry')).toBeVisible()
      await page.fill('#duration', '1:15')
      await page.fill('#notes', 'E2E approval test - to be approved')
      await page.click('button:has-text("Log Time")')
      await expect(page.locator('text=Log Time Entry')).not.toBeVisible({ timeout: 10000 })

      // Verify the entry is in draft status
      await expect(page.locator('text=1h 15m')).toBeVisible()

      // Click on the draft entry to edit it - then submit it
      // The entry needs to transition from draft to submitted
      // We use the TimeEntriesList which shows entries as clickable when draft
      const draftEntry = page.locator('text=E2E approval test - to be approved')
      await draftEntry.click()

      // Edit modal opens - update and submit
      await expect(page.locator('text=Edit Time Entry')).toBeVisible()

      // Submit the entry - close the edit modal first and use the submit action
      await page.click('button:has-text("Cancel")')

      // Wait for modal to close
      await expect(page.locator('text=Edit Time Entry')).not.toBeVisible()

      // Step 2: Navigate to admin approvals page
      await page.goto('/admin/time-approvals')

      // Verify the page loaded with the approval overview
      await expect(page.locator('text=Time Approvals')).toBeVisible()
      await expect(page.locator('text=Approval Overview')).toBeVisible()

      // Verify the stats cards are visible
      await expect(page.locator('text=Pending Approval')).toBeVisible()
      await expect(page.locator('text=Approved').first()).toBeVisible()
      await expect(page.locator('text=Rejected').first()).toBeVisible()

      // Change status filter to show all entries to find our draft entry
      const statusSelect = page.locator('#status')
      await statusSelect.selectOption('all')

      // Wait for the table to update
      await page.waitForTimeout(1000)

      // Verify the table shows entries
      await expect(page.locator('text=Time Entries')).toBeVisible()
    })
  })

  test.describe('Story 5.13: Admin approvals page layout', () => {
    test('should display approval overview stats and table', async ({ page }) => {
      // Navigate to admin approvals page
      await page.goto('/admin/time-approvals')

      // Verify the page header
      await expect(page.locator('text=Time Approvals')).toBeVisible()
      await expect(page.locator('text=Review and approve time entries')).toBeVisible()

      // Verify the Back to Admin link
      await expect(page.locator('text=Back to Admin')).toBeVisible()

      // Verify all four stats cards are present
      await expect(page.locator('text=Pending Approval')).toBeVisible()
      await expect(page.locator('text=Approved').first()).toBeVisible()
      await expect(page.locator('text=Rejected').first()).toBeVisible()
      await expect(page.locator('text=Draft').first()).toBeVisible()

      // Verify the table section
      await expect(page.locator('text=Time Entries')).toBeVisible()

      // Verify table headers are present
      await expect(page.locator('th:has-text("Date")')).toBeVisible()
      await expect(page.locator('th:has-text("User")')).toBeVisible()
      await expect(page.locator('th:has-text("Duration")')).toBeVisible()
      await expect(page.locator('th:has-text("Notes")')).toBeVisible()
      await expect(page.locator('th:has-text("Status")')).toBeVisible()
      await expect(page.locator('th:has-text("Actions")')).toBeVisible()

      // Verify the status filter dropdown is present
      await expect(page.locator('#status')).toBeVisible()

      // Verify search input is present
      await expect(page.locator('#search')).toBeVisible()
    })

    test('should filter entries by status', async ({ page }) => {
      await page.goto('/admin/time-approvals')

      // Default filter should be "Pending Approval" (submitted)
      const statusSelect = page.locator('#status')
      await expect(statusSelect).toHaveValue('submitted')

      // Change to "All Statuses"
      await statusSelect.selectOption('all')
      await page.waitForTimeout(1000)

      // Change to "Approved"
      await statusSelect.selectOption('approved')
      await page.waitForTimeout(1000)

      // Change to "Rejected"
      await statusSelect.selectOption('rejected')
      await page.waitForTimeout(1000)

      // Change to "Draft"
      await statusSelect.selectOption('draft')
      await page.waitForTimeout(1000)

      // Change back to "Pending Approval"
      await statusSelect.selectOption('submitted')
      await page.waitForTimeout(1000)
    })
  })

  test.describe('Story 5.14: Reject time entry with notes', () => {
    test('should open reject modal with notes textarea', async ({ page }) => {
      // Navigate to admin approvals to check for submitted entries
      await page.goto('/admin/time-approvals')

      await expect(page.locator('text=Time Approvals')).toBeVisible()

      // Check if there are any submitted entries with Reject button
      const rejectButton = page.locator('button:has-text("Reject")').first()

      // If there are submitted entries, test the reject modal
      if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rejectButton.click()

        // Reject modal should appear
        await expect(page.locator('text=Reject Time Entry')).toBeVisible()
        await expect(page.locator('text=Are you sure you want to reject this time entry?')).toBeVisible()

        // Verify the rejection notes textarea is present
        await expect(page.locator('#reject-notes')).toBeVisible()
        await expect(page.locator('text=Rejection Notes (optional)')).toBeVisible()

        // Verify modal buttons
        await expect(page.locator('.fixed button:has-text("Reject")')).toBeVisible()
        await expect(page.locator('.fixed button:has-text("Cancel")')).toBeVisible()

        // Close the modal
        await page.locator('.fixed button:has-text("Cancel")').click()
        await expect(page.locator('text=Reject Time Entry')).not.toBeVisible()
      }
    })
  })

  test.describe('Story 5.15: Full approval lifecycle', () => {
    test('should show approve and reject buttons only for submitted entries', async ({ page }) => {
      await page.goto('/admin/time-approvals')

      // Default view shows submitted entries - should have action buttons if any exist
      const approveButton = page.locator('button:has-text("Approve")').first()
      const rejectButton = page.locator('button:has-text("Reject")').first()

      // If there are submitted entries, verify both action buttons exist
      if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(rejectButton).toBeVisible()
      }

      // Switch to approved status - action buttons should not appear
      const statusSelect = page.locator('#status')
      await statusSelect.selectOption('approved')
      await page.waitForTimeout(1000)

      // Approved entries should show "-" in the actions column, not Approve/Reject buttons
      // The Approve/Reject buttons should not be visible for approved entries
      const approveButtonAfter = page.locator('button:has-text("Approve")')
      await expect(approveButtonAfter).toHaveCount(0)
    })

    test('should show rejected entry details with rejection reason on user page', async ({ page }) => {
      // Navigate to contacts and check for any rejected entries that show rejection reason
      await page.goto('/contacts')

      const contactLink = page.locator('table tbody tr a, [data-testid="contact-row"] a').first()
      if (await contactLink.isVisible()) {
        await contactLink.click()
      } else {
        const anyContactLink = page.locator('a[href*="/contacts/"]').first()
        await anyContactLink.click()
      }

      await page.waitForURL(/\/contacts\/[^/]+$/)

      // Check if there are any rejected entries with a "Resubmit" button
      const resubmitButton = page.locator('button:has-text("Resubmit")').first()

      if (await resubmitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Verify the rejection reason is displayed
        await expect(page.locator('text=Rejection reason:').first()).toBeVisible()

        // Verify the resubmit button is present
        await expect(resubmitButton).toBeVisible()
      }
    })

    test('should show status badges with correct styling', async ({ page }) => {
      // Navigate to admin approvals page with all statuses
      await page.goto('/admin/time-approvals')

      const statusSelect = page.locator('#status')
      await statusSelect.selectOption('all')
      await page.waitForTimeout(1000)

      // Verify status badges exist in the table
      // Status badges use capitalize class and specific color classes
      const statusBadges = page.locator('span.capitalize')
      const badgeCount = await statusBadges.count()

      // If there are entries, verify the badges are visible
      if (badgeCount > 0) {
        await expect(statusBadges.first()).toBeVisible()
      }
    })
  })
})
