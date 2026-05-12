import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStage,
  getDealById
} from '@/app/deals/actions'

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis()
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('Deal Actions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser }
    })
    // Reset chain methods
    mockSupabase.from.mockReturnThis()
    mockSupabase.select.mockReturnThis()
    mockSupabase.eq.mockReturnThis()
    mockSupabase.is.mockReturnThis()
    mockSupabase.insert.mockReturnThis()
    mockSupabase.update.mockReturnThis()
  })

  describe('createDeal', () => {
    it('should create a new deal with required fields', async () => {
      const mockDeal = {
        id: 'deal-123',
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000,
        stage: 'lead',
        probability: 0,
        owner_id: mockUser.id
      }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockDeal,
            error: null
          })
        })
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000
      }

      const result = await createDeal(formData)

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(mockDeal)
      expect(mockSupabase.from).toHaveBeenCalledWith('deals')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Deal',
          contact_id: 'contact-123',
          amount: 5000,
          stage: 'lead',
          probability: 0,
          owner_id: mockUser.id
        })
      )
    })

    it('should trim the title', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockDeal,
            error: null
          })
        })
      })

      const formData = {
        title: '  New Deal  ',
        contact_id: 'contact-123',
        amount: 5000
      }

      await createDeal(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Deal'
        })
      )
    })

    it('should trim and nullify empty description', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockDeal,
            error: null
          })
        })
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000,
        description: '   '
      }

      await createDeal(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null
        })
      )
    })

    it('should set optional fields to defaults when not provided', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockDeal,
            error: null
          })
        })
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000
      }

      await createDeal(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          expected_close_date: null,
          stage: 'lead',
          probability: 0
        })
      )
    })

    it('should use provided stage and probability', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockDeal,
            error: null
          })
        })
      })

      const formData = {
        title: 'Big Deal',
        contact_id: 'contact-123',
        amount: 50000,
        stage: 'proposal' as const,
        probability: 60,
        expected_close_date: '2026-03-15'
      }

      await createDeal(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'proposal',
          probability: 60,
          expected_close_date: '2026-03-15'
        })
      )
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000
      }

      const result = await createDeal(formData)

      expect(result.error).toBe('You must be logged in to create a deal')
    })

    it('should return error on database failure', async () => {
      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: null,
            error: { code: '500', message: 'Server error' }
          })
        })
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000
      }

      const result = await createDeal(formData)

      expect(result.error).toBe('Failed to create deal. Please try again.')
    })

    it('should return error on auth error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' }
      })

      const formData = {
        title: 'New Deal',
        contact_id: 'contact-123',
        amount: 5000
      }

      const result = await createDeal(formData)

      expect(result.error).toBe('You must be logged in to create a deal')
    })
  })

  describe('updateDeal', () => {
    it('should update an existing deal', async () => {
      const mockDeal = {
        id: 'deal-123',
        title: 'Updated Deal',
        amount: 10000,
        stage: 'negotiation'
      }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      const formData = {
        title: 'Updated Deal',
        amount: 10000,
        stage: 'negotiation' as const
      }

      const result = await updateDeal('deal-123', formData)

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(mockDeal)
      expect(mockSupabase.from).toHaveBeenCalledWith('deals')
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Deal',
          amount: 10000,
          stage: 'negotiation',
          updated_at: expect.any(String)
        })
      )
    })

    it('should only include provided fields in update', async () => {
      const mockDeal = { id: 'deal-123', title: 'Only Title' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      await updateDeal('deal-123', { title: 'Only Title' })

      const updateArg = mockSupabase.update.mock.calls[0][0]
      expect(updateArg.title).toBe('Only Title')
      expect(updateArg.updated_at).toBeDefined()
      // Fields not provided should not be in the update object
      expect(updateArg).not.toHaveProperty('amount')
      expect(updateArg).not.toHaveProperty('stage')
    })

    it('should trim the title on update', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      await updateDeal('deal-123', { title: '  Trimmed Title  ' })

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Trimmed Title'
        })
      )
    })

    it('should nullify empty description on update', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      await updateDeal('deal-123', { description: '   ' })

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null
        })
      )
    })

    it('should allow setting probability to 0', async () => {
      const mockDeal = { id: 'deal-123' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      await updateDeal('deal-123', { probability: 0 })

      const updateArg = mockSupabase.update.mock.calls[0][0]
      expect(updateArg.probability).toBe(0)
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await updateDeal('deal-123', { title: 'Updated' })

      expect(result.error).toBe('You must be logged in to update a deal')
    })

    it('should return error on database failure', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '500', message: 'Server error' }
            })
          })
        })
      })

      const result = await updateDeal('deal-123', { title: 'Updated' })

      expect(result.error).toBe('Failed to update deal. Please try again.')
    })
  })

  describe('deleteDeal', () => {
    it('should soft delete a deal', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          is: () => Promise.resolve({
            error: null
          })
        })
      })

      const result = await deleteDeal('deal-123')

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('deals')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String)
      })
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await deleteDeal('deal-123')

      expect(result.error).toBe('You must be logged in to delete a deal')
    })

    it('should return error on database failure', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          is: () => Promise.resolve({
            error: { message: 'Server error' }
          })
        })
      })

      const result = await deleteDeal('deal-123')

      expect(result.error).toBe('Failed to delete deal. Please try again.')
    })
  })

  describe('updateDealStage', () => {
    it('should update deal stage', async () => {
      const mockDeal = {
        id: 'deal-123',
        stage: 'proposal'
      }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      const result = await updateDealStage('deal-123', 'proposal')

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(mockDeal)
      expect(mockSupabase.from).toHaveBeenCalledWith('deals')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        stage: 'proposal',
        updated_at: expect.any(String)
      })
    })

    it('should update to closed-won stage', async () => {
      const mockDeal = { id: 'deal-123', stage: 'closed-won' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      const result = await updateDealStage('deal-123', 'closed-won')

      expect(result.data.stage).toBe('closed-won')
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'closed-won' })
      )
    })

    it('should update to closed-lost stage', async () => {
      const mockDeal = { id: 'deal-123', stage: 'closed-lost' }

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockDeal,
              error: null
            })
          })
        })
      })

      const result = await updateDealStage('deal-123', 'closed-lost')

      expect(result.data.stage).toBe('closed-lost')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await updateDealStage('deal-123', 'proposal')

      expect(result.error).toBe('You must be logged in to update a deal')
    })

    it('should return error on database failure', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '500', message: 'Server error' }
            })
          })
        })
      })

      const result = await updateDealStage('deal-123', 'negotiation')

      expect(result.error).toBe('Failed to update deal stage. Please try again.')
    })
  })

  describe('getDealById', () => {
    it('should fetch a deal by id with related data', async () => {
      const mockDeal = {
        id: 'deal-123',
        title: 'Big Deal',
        amount: 50000,
        stage: 'proposal',
        contact: {
          id: 'contact-123',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          company: 'Acme Inc'
        },
        owner: {
          id: 'user-123',
          full_name: 'Test User',
          email: 'test@example.com'
        }
      }

      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: mockDeal,
          error: null
        })
      })

      const result = await getDealById('deal-123')

      expect(result.data).toEqual(mockDeal)
      expect(result.error).toBeUndefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('deals')
      expect(mockSupabase.select).toHaveBeenCalledWith(expect.stringContaining('contact:contacts'))
      expect(mockSupabase.select).toHaveBeenCalledWith(expect.stringContaining('owner:users'))
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'deal-123')
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null)
    })

    it('should return error when deal is not found', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      })

      const result = await getDealById('nonexistent-id')

      expect(result.error).toBe('Deal not found')
    })

    it('should return error on database failure', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: '500', message: 'Server error' }
        })
      })

      const result = await getDealById('deal-123')

      expect(result.error).toBe('Deal not found')
    })
  })
})
