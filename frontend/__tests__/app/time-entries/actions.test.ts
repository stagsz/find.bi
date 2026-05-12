import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  submitTimeEntry,
  approveTimeEntry,
  rejectTimeEntry,
  getUserTimeEntries,
  getTimeEntriesForContact,
  getTimeEntriesForDeal,
  exportTimeEntriesToCSV,
} from '@/app/time-entries/actions'

// Mock Supabase with chainable query builder
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

let mockIsAdmin = false
vi.mock('@/lib/auth/permissions', () => ({
  isAdmin: () => Promise.resolve(mockIsAdmin),
}))

describe('Time Entry Actions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin = false
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
    })
    // Reset chain methods
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.gte.mockReturnThis()
    mockSupabase.lte.mockReturnThis()
    mockSupabase.order.mockReturnThis()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.update.mockReturnThis()
    mockSupabase.delete.mockReturnThis()
  })

  // ─── createTimeEntry ───────────────────────────────────────────────────

  describe('createTimeEntry', () => {
    it('should create a new time entry with all fields', async () => {
      const mockEntry = {
        id: 'te-1',
        user_id: mockUser.id,
        contact_id: 'c-1',
        deal_id: 'd-1',
        duration_minutes: 60,
        entry_date: '2026-02-05',
        notes: 'Test notes',
        is_billable: true,
        status: 'draft',
      }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: mockEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('contact_id', 'c-1')
      formData.append('deal_id', 'd-1')
      formData.append('duration_minutes', '60')
      formData.append('entry_date', '2026-02-05')
      formData.append('notes', 'Test notes')
      formData.append('is_billable', 'true')

      const result = await createTimeEntry(formData)

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockEntry)
      expect(mockSupabase.from).toHaveBeenCalledWith('time_entries')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          contact_id: 'c-1',
          deal_id: 'd-1',
          duration_minutes: 60,
          entry_date: '2026-02-05',
          notes: 'Test notes',
          is_billable: true,
          status: 'draft',
        })
      )
    })

    it('should set optional fields to null when not provided', async () => {
      const mockEntry = { id: 'te-1', user_id: mockUser.id, status: 'draft' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: mockEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '30')
      formData.append('entry_date', '2026-02-05')

      await createTimeEntry(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_id: null,
          deal_id: null,
          activity_id: null,
          notes: null,
          is_billable: false,
        })
      )
    })

    it('should return error when duration is missing', async () => {
      const formData = new FormData()
      formData.append('entry_date', '2026-02-05')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Duration must be greater than 0')
    })

    it('should return error when duration is zero', async () => {
      const formData = new FormData()
      formData.append('duration_minutes', '0')
      formData.append('entry_date', '2026-02-05')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Duration must be greater than 0')
    })

    it('should return error when duration is negative', async () => {
      const formData = new FormData()
      formData.append('duration_minutes', '-10')
      formData.append('entry_date', '2026-02-05')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Duration must be greater than 0')
    })

    it('should return error when entry_date is missing', async () => {
      const formData = new FormData()
      formData.append('duration_minutes', '30')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Entry date is required')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const formData = new FormData()
      formData.append('duration_minutes', '30')
      formData.append('entry_date', '2026-02-05')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Unauthorized')
    })

    it('should return supabase error on insert failure', async () => {
      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: null,
              error: { message: 'Insert failed' },
            }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '30')
      formData.append('entry_date', '2026-02-05')

      const result = await createTimeEntry(formData)

      expect(result.error).toBe('Insert failed')
    })
  })

  // ─── updateTimeEntry ──────────────────────────────────────────────────

  describe('updateTimeEntry', () => {
    const draftEntry = {
      status: 'draft',
      user_id: mockUser.id,
      contact_id: 'c-1',
      deal_id: 'd-1',
    }

    it('should update a draft time entry', async () => {
      const mockUpdated = { id: 'te-1', duration_minutes: 90 }

      // Mock the fetch of existing entry
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: mockUpdated, error: null }),
          }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')
      formData.append('notes', 'Updated notes')
      formData.append('is_billable', 'true')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockUpdated)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_minutes: 90,
          entry_date: '2026-02-05',
          notes: 'Updated notes',
          is_billable: true,
          updated_at: expect.any(String),
        })
      )
    })

    it('should allow updating a rejected time entry', async () => {
      const rejectedEntry = { ...draftEntry, status: 'rejected' }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: rejectedEntry, error: null }),
        }),
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: 'te-1' }, error: null }),
          }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '45')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBeNull()
    })

    it('should prevent editing approved time entries', async () => {
      const approvedEntry = { ...draftEntry, status: 'approved' }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: approvedEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe('Cannot edit approved time entries')
    })

    it('should prevent editing submitted time entries', async () => {
      const submittedEntry = { ...draftEntry, status: 'submitted' }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe(
        'Cannot edit time entries pending approval. Please wait for admin review or ask to have it rejected.'
      )
    })

    it('should prevent editing another user\'s time entry', async () => {
      const otherUserEntry = { ...draftEntry, user_id: 'other-user-456' }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: otherUserEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe('You can only edit your own time entries')
    })

    it('should return error when time entry not found', async () => {
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('nonexistent', formData)

      expect(result.error).toBe('Time entry not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const formData = new FormData()
      formData.append('duration_minutes', '90')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe('Unauthorized')
    })

    it('should return error when duration is invalid', async () => {
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '0')
      formData.append('entry_date', '2026-02-05')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe('Duration must be greater than 0')
    })

    it('should return error when entry_date is missing on update', async () => {
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('duration_minutes', '30')

      const result = await updateTimeEntry('te-1', formData)

      expect(result.error).toBe('Entry date is required')
    })
  })

  // ─── deleteTimeEntry ──────────────────────────────────────────────────

  describe('deleteTimeEntry', () => {
    it('should delete a draft time entry', async () => {
      const draftEntry = {
        status: 'draft',
        user_id: mockUser.id,
        contact_id: 'c-1',
        deal_id: 'd-1',
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      mockSupabase.delete.mockReturnValue({
        eq: () => Promise.resolve({ error: null }),
      })

      const result = await deleteTimeEntry('te-1')

      expect(result.error).toBeNull()
      expect(mockSupabase.from).toHaveBeenCalledWith('time_entries')
    })

    it('should prevent deletion of non-draft time entries', async () => {
      const submittedEntry = {
        status: 'submitted',
        user_id: mockUser.id,
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      const result = await deleteTimeEntry('te-1')

      expect(result.error).toBe('Only draft time entries can be deleted')
    })

    it('should prevent deletion of approved time entries', async () => {
      const approvedEntry = {
        status: 'approved',
        user_id: mockUser.id,
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: approvedEntry, error: null }),
        }),
      })

      const result = await deleteTimeEntry('te-1')

      expect(result.error).toBe('Only draft time entries can be deleted')
    })

    it('should return error when time entry not found', async () => {
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const result = await deleteTimeEntry('nonexistent')

      expect(result.error).toBe('Time entry not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await deleteTimeEntry('te-1')

      expect(result.error).toBe('Unauthorized')
    })
  })

  // ─── submitTimeEntry ──────────────────────────────────────────────────

  describe('submitTimeEntry', () => {
    it('should submit a draft time entry for approval', async () => {
      const draftEntry = {
        status: 'draft',
        user_id: mockUser.id,
        contact_id: 'c-1',
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      const mockSubmitted = { id: 'te-1', status: 'submitted' }
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: mockSubmitted, error: null }),
          }),
        }),
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubmitted)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'submitted',
          approval_notes: null,
          approved_by: null,
          approved_at: null,
          updated_at: expect.any(String),
        })
      )
    })

    it('should allow resubmitting a rejected entry', async () => {
      const rejectedEntry = {
        status: 'rejected',
        user_id: mockUser.id,
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: rejectedEntry, error: null }),
        }),
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: 'te-1', status: 'submitted' },
                error: null,
              }),
          }),
        }),
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBeNull()
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'submitted',
          approval_notes: null,
          approved_by: null,
          approved_at: null,
        })
      )
    })

    it('should prevent submitting an already submitted entry', async () => {
      const submittedEntry = {
        status: 'submitted',
        user_id: mockUser.id,
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBe(
        'Only draft or rejected time entries can be submitted for approval'
      )
    })

    it('should prevent submitting an approved entry', async () => {
      const approvedEntry = {
        status: 'approved',
        user_id: mockUser.id,
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: approvedEntry, error: null }),
        }),
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBe(
        'Only draft or rejected time entries can be submitted for approval'
      )
    })

    it('should prevent submitting another user\'s time entry', async () => {
      const otherUserEntry = {
        status: 'draft',
        user_id: 'other-user-456',
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: otherUserEntry, error: null }),
        }),
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBe('You can only submit your own time entries')
    })

    it('should return error when time entry not found', async () => {
      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const result = await submitTimeEntry('nonexistent')

      expect(result.error).toBe('Time entry not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await submitTimeEntry('te-1')

      expect(result.error).toBe('Unauthorized')
    })
  })

  // ─── approveTimeEntry ─────────────────────────────────────────────────

  describe('approveTimeEntry', () => {
    it('should approve a submitted time entry as admin', async () => {
      mockIsAdmin = true

      const submittedEntry = {
        status: 'submitted',
        contact_id: 'c-1',
        deal_id: 'd-1',
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      const mockApproved = { id: 'te-1', status: 'approved' }
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: mockApproved, error: null }),
          }),
        }),
      })

      const result = await approveTimeEntry('te-1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockApproved)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          approved_by: mockUser.id,
          approved_at: expect.any(String),
          approval_notes: null,
          updated_at: expect.any(String),
        })
      )
    })

    it('should prevent non-admin from approving', async () => {
      mockIsAdmin = false

      const result = await approveTimeEntry('te-1')

      expect(result.error).toBe('Only admins can approve time entries')
    })

    it('should prevent approving a non-submitted entry', async () => {
      mockIsAdmin = true

      const draftEntry = {
        status: 'draft',
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      const result = await approveTimeEntry('te-1')

      expect(result.error).toBe('Only submitted time entries can be approved')
    })

    it('should return error when time entry not found', async () => {
      mockIsAdmin = true

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const result = await approveTimeEntry('nonexistent')

      expect(result.error).toBe('Time entry not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await approveTimeEntry('te-1')

      expect(result.error).toBe('Unauthorized')
    })
  })

  // ─── rejectTimeEntry ──────────────────────────────────────────────────

  describe('rejectTimeEntry', () => {
    it('should reject a submitted time entry with notes', async () => {
      mockIsAdmin = true

      const submittedEntry = {
        status: 'submitted',
        contact_id: 'c-1',
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      const mockRejected = {
        id: 'te-1',
        status: 'rejected',
        approval_notes: 'Needs more detail',
      }
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({ data: mockRejected, error: null }),
          }),
        }),
      })

      const result = await rejectTimeEntry('te-1', 'Needs more detail')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockRejected)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          approved_by: mockUser.id,
          approved_at: expect.any(String),
          approval_notes: 'Needs more detail',
          updated_at: expect.any(String),
        })
      )
    })

    it('should reject without notes (notes set to null)', async () => {
      mockIsAdmin = true

      const submittedEntry = {
        status: 'submitted',
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: submittedEntry, error: null }),
        }),
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: 'te-1', status: 'rejected' },
                error: null,
              }),
          }),
        }),
      })

      const result = await rejectTimeEntry('te-1')

      expect(result.error).toBeNull()
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          approval_notes: null,
        })
      )
    })

    it('should prevent non-admin from rejecting', async () => {
      mockIsAdmin = false

      const result = await rejectTimeEntry('te-1', 'Rejected')

      expect(result.error).toBe('Only admins can reject time entries')
    })

    it('should prevent rejecting a non-submitted entry', async () => {
      mockIsAdmin = true

      const draftEntry = {
        status: 'draft',
        contact_id: null,
        deal_id: null,
      }

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: draftEntry, error: null }),
        }),
      })

      const result = await rejectTimeEntry('te-1')

      expect(result.error).toBe('Only submitted time entries can be rejected')
    })

    it('should return error when time entry not found', async () => {
      mockIsAdmin = true

      mockSupabase.select.mockReturnValue({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const result = await rejectTimeEntry('nonexistent')

      expect(result.error).toBe('Time entry not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await rejectTimeEntry('te-1')

      expect(result.error).toBe('Unauthorized')
    })
  })

  // ─── getUserTimeEntries ───────────────────────────────────────────────

  describe('getUserTimeEntries', () => {
    it('should return user time entries without filters', async () => {
      const mockEntries = [
        { id: 'te-1', duration_minutes: 60, entry_date: '2026-02-05' },
        { id: 'te-2', duration_minutes: 30, entry_date: '2026-02-04' },
      ]

      mockSupabase.order.mockResolvedValue({
        data: mockEntries,
        error: null,
      })

      const result = await getUserTimeEntries()

      expect(result).toEqual(mockEntries)
      expect(mockSupabase.from).toHaveBeenCalledWith('time_entries')
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUser.id)
    })

    it('should apply status filter', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      })

      await getUserTimeEntries({ status: 'draft' })

      // eq called for user_id and status
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUser.id)
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'draft')
    })

    it('should apply date range filters', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      })

      await getUserTimeEntries({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      })

      expect(mockSupabase.gte).toHaveBeenCalledWith(
        'entry_date',
        '2026-01-01'
      )
      expect(mockSupabase.lte).toHaveBeenCalledWith(
        'entry_date',
        '2026-01-31'
      )
    })

    it('should return empty array when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      })

      const result = await getUserTimeEntries()

      expect(result).toEqual([])
    })

    it('should return empty array on error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      })

      const result = await getUserTimeEntries()

      expect(result).toEqual([])
    })
  })

  // ─── getTimeEntriesForContact ─────────────────────────────────────────

  describe('getTimeEntriesForContact', () => {
    it('should return time entries for a contact', async () => {
      const mockEntries = [
        { id: 'te-1', contact_id: 'c-1', duration_minutes: 60 },
      ]

      mockSupabase.order.mockResolvedValue({
        data: mockEntries,
        error: null,
      })

      const result = await getTimeEntriesForContact('c-1')

      expect(result).toEqual(mockEntries)
      expect(mockSupabase.from).toHaveBeenCalledWith('time_entries')
      expect(mockSupabase.eq).toHaveBeenCalledWith('contact_id', 'c-1')
    })

    it('should return empty array on error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      })

      const result = await getTimeEntriesForContact('c-1')

      expect(result).toEqual([])
    })
  })

  // ─── getTimeEntriesForDeal ────────────────────────────────────────────

  describe('getTimeEntriesForDeal', () => {
    it('should return time entries for a deal', async () => {
      const mockEntries = [
        { id: 'te-1', deal_id: 'd-1', duration_minutes: 120 },
      ]

      mockSupabase.order.mockResolvedValue({
        data: mockEntries,
        error: null,
      })

      const result = await getTimeEntriesForDeal('d-1')

      expect(result).toEqual(mockEntries)
      expect(mockSupabase.from).toHaveBeenCalledWith('time_entries')
      expect(mockSupabase.eq).toHaveBeenCalledWith('deal_id', 'd-1')
    })

    it('should return empty array on error', async () => {
      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      })

      const result = await getTimeEntriesForDeal('d-1')

      expect(result).toEqual([])
    })
  })

  // ─── exportTimeEntriesToCSV ───────────────────────────────────────────

  describe('exportTimeEntriesToCSV', () => {
    it('should export time entries as CSV for admin', async () => {
      mockIsAdmin = true

      const mockEntries = [
        {
          id: 'te-1',
          entry_date: '2026-02-05',
          duration_minutes: 60,
          notes: 'Test work',
          is_billable: true,
          status: 'approved',
          approval_notes: null,
          created_at: '2026-02-05T10:00:00Z',
          user: { id: 'u-1', email: 'john@test.com', full_name: 'John Doe' },
          contact: {
            id: 'c-1',
            first_name: 'Jane',
            last_name: 'Smith',
            company: 'Acme Inc',
          },
          deal: { id: 'd-1', title: 'Big Deal' },
          activity: { id: 'a-1', type: 'call', subject: 'Intro call' },
        },
      ]

      mockSupabase.order.mockResolvedValue({
        data: mockEntries,
        error: null,
      })

      const result = await exportTimeEntriesToCSV({})

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.count).toBe(1)
      expect(result.data!.csv).toContain('Entry Date')
      expect(result.data!.csv).toContain('John Doe')
      expect(result.data!.csv).toContain('Jane Smith')
      expect(result.data!.csv).toContain('Acme Inc')
      expect(result.data!.csv).toContain('Big Deal')
      expect(result.data!.csv).toContain('Yes') // billable
    })

    it('should prevent non-admin from exporting', async () => {
      mockIsAdmin = false

      const result = await exportTimeEntriesToCSV({})

      expect(result.error).toBe('Only admins can export time entries')
    })

    it('should return error when no entries found', async () => {
      mockIsAdmin = true

      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await exportTimeEntriesToCSV({})

      expect(result.error).toBe('No time entries found to export')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const result = await exportTimeEntriesToCSV({})

      expect(result.error).toBe(
        'You must be logged in to export time entries'
      )
    })

    it('should handle entries with missing related data', async () => {
      mockIsAdmin = true

      const mockEntries = [
        {
          id: 'te-1',
          entry_date: '2026-02-05',
          duration_minutes: 30,
          notes: null,
          is_billable: false,
          status: 'draft',
          approval_notes: null,
          created_at: '2026-02-05T10:00:00Z',
          user: { id: 'u-1', email: 'john@test.com', full_name: null },
          contact: null,
          deal: null,
          activity: null,
        },
      ]

      mockSupabase.order.mockResolvedValue({
        data: mockEntries,
        error: null,
      })

      const result = await exportTimeEntriesToCSV({})

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!.csv).toContain('No') // not billable
    })
  })
})
