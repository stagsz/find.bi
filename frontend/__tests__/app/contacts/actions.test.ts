import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkEmailExists,
  createContact,
  getContact,
  updateContact,
  deleteContact,
  importContactsFromCSV,
  exportContactsToCSV
} from '@/app/contacts/actions'

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
  single: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis()
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

describe('Contact Actions', () => {
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
    mockSupabase.order.mockReturnThis()
    mockSupabase.or.mockReturnThis()
  })

  describe('checkEmailExists', () => {
    it('should return true when email exists', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: { id: 'contact-123' },
          error: null
        })
      })

      const result = await checkEmailExists('test@example.com')

      expect(result).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts')
      expect(mockSupabase.select).toHaveBeenCalledWith('id')
      expect(mockSupabase.eq).toHaveBeenCalledWith('email', 'test@example.com')
    })

    it('should return false when email does not exist', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' }
        })
      })

      const result = await checkEmailExists('nonexistent@example.com')

      expect(result).toBe(false)
    })

    it('should return false on unexpected error', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: '500', message: 'Server error' }
        })
      })

      const result = await checkEmailExists('test@example.com')

      expect(result).toBe(false)
    })
  })

  describe('createContact', () => {
    it('should create a new contact with required fields', async () => {
      const mockContact = {
        id: 'contact-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead',
        owner_id: mockUser.id
      }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockContact,
            error: null
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const
      }

      const result = await createContact(formData)

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(mockContact)
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts')
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          status: 'lead',
          owner_id: mockUser.id
        })
      )
    })

    it('should trim and lowercase email', async () => {
      const mockContact = {
        id: 'contact-123',
        email: 'john@example.com'
      }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockContact,
            error: null
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: '  JOHN@Example.COM  ',
        status: 'lead' as const
      }

      await createContact(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john@example.com'
        })
      )
    })

    it('should process custom fields into an object', async () => {
      const mockContact = { id: 'contact-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockContact,
            error: null
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const,
        custom_fields: [
          { key: 'Industry', value: 'Tech' },
          { key: 'Source', value: 'Website' }
        ]
      }

      await createContact(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_fields: { Industry: 'Tech', Source: 'Website' }
        })
      )
    })

    it('should skip empty custom fields', async () => {
      const mockContact = { id: 'contact-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockContact,
            error: null
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const,
        custom_fields: [
          { key: 'Industry', value: 'Tech' },
          { key: '', value: 'Ignored' },
          { key: 'Empty', value: '' }
        ]
      }

      await createContact(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_fields: { Industry: 'Tech' }
        })
      )
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const
      }

      const result = await createContact(formData)

      expect(result.error).toBe('You must be logged in to create a contact')
    })

    it('should return duplicate email error on code 23505', async () => {
      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: null,
            error: { code: '23505', message: 'duplicate key' }
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'existing@example.com',
        status: 'lead' as const
      }

      const result = await createContact(formData)

      expect(result.error).toBe('A contact with this email already exists')
    })

    it('should return generic error on database failure', async () => {
      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: null,
            error: { code: '500', message: 'Server error' }
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const
      }

      const result = await createContact(formData)

      expect(result.error).toBe('Failed to create contact. Please try again.')
    })

    it('should set optional fields to null when not provided', async () => {
      const mockContact = { id: 'contact-123' }

      mockSupabase.insert.mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({
            data: mockContact,
            error: null
          })
        })
      })

      const formData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        status: 'lead' as const
      }

      await createContact(formData)

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: null,
          company: null,
          title: null
        })
      )
    })
  })

  describe('getContact', () => {
    it('should fetch a contact by id', async () => {
      const mockContact = {
        id: 'contact-123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      }

      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: mockContact,
          error: null
        })
      })

      const result = await getContact('contact-123')

      expect(result.data).toEqual(mockContact)
      expect(result.error).toBeUndefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'contact-123')
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null)
    })

    it('should return error when contact is not found', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      })

      const result = await getContact('nonexistent-id')

      expect(result.error).toBe('Contact not found')
    })
  })

  describe('updateContact', () => {
    it('should update an existing contact', async () => {
      const mockContact = {
        id: 'contact-123',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com'
      }

      // Mock the fetch-existing check
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: { id: 'contact-123', owner_id: mockUser.id },
          error: null
        })
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: mockContact,
              error: null
            })
          })
        })
      })

      const formData = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        status: 'customer' as const
      }

      const result = await updateContact('contact-123', formData)

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(mockContact)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          status: 'customer',
          updated_at: expect.any(String)
        })
      )
    })

    it('should return error when contact does not exist', async () => {
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      })

      const formData = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        status: 'customer' as const
      }

      const result = await updateContact('nonexistent-id', formData)

      expect(result.error).toBe('Contact not found')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const formData = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        status: 'customer' as const
      }

      const result = await updateContact('contact-123', formData)

      expect(result.error).toBe('You must be logged in to update a contact')
    })

    it('should return duplicate email error on code 23505', async () => {
      // Mock the fetch-existing check
      mockSupabase.is.mockReturnValue({
        single: () => Promise.resolve({
          data: { id: 'contact-123', owner_id: mockUser.id },
          error: null
        })
      })

      mockSupabase.update.mockReturnValue({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: null,
              error: { code: '23505', message: 'duplicate key' }
            })
          })
        })
      })

      const formData = {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'existing@example.com',
        status: 'customer' as const
      }

      const result = await updateContact('contact-123', formData)

      expect(result.error).toBe('A contact with this email already exists')
    })
  })

  describe('deleteContact', () => {
    it('should soft delete a contact', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          is: () => Promise.resolve({
            error: null
          })
        })
      })

      const result = await deleteContact('contact-123')

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String)
      })
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await deleteContact('contact-123')

      expect(result.error).toBe('You must be logged in to delete a contact')
    })

    it('should return error on database failure', async () => {
      mockSupabase.update.mockReturnValue({
        eq: () => ({
          is: () => Promise.resolve({
            error: { message: 'Server error' }
          })
        })
      })

      const result = await deleteContact('contact-123')

      expect(result.error).toBe('Failed to delete contact. Please try again.')
    })
  })

  describe('importContactsFromCSV', () => {
    it('should import valid contacts', async () => {
      // Mock fetching existing contacts for duplicate check
      mockSupabase.is.mockReturnValue(
        Promise.resolve({
          data: [],
          error: null
        })
      )

      mockSupabase.insert.mockReturnValue(
        Promise.resolve({ error: null })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          status: 'lead' as const
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          status: 'customer' as const
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(
        expect.objectContaining({
          success: 2,
          failed: 0,
          duplicates: 0
        })
      )
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await importContactsFromCSV([])

      expect(result.error).toBe('You must be logged in to import contacts')
    })

    it('should skip rows with missing first name', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      const contacts = [
        {
          first_name: '',
          last_name: 'Doe',
          email: 'john@example.com'
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('First name is required')
    })

    it('should skip rows with missing last name', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: '',
          email: 'john@example.com'
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('Last name is required')
    })

    it('should skip rows with missing email', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: ''
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('Email is required')
    })

    it('should skip rows with invalid email format', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'not-an-email'
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('Invalid email format')
    })

    it('should skip duplicate emails', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({
          data: [{ email: 'existing@example.com' }],
          error: null
        })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'existing@example.com'
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.duplicates).toBe(1)
      expect(result.data.success).toBe(0)
    })

    it('should skip rows with invalid status', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          status: 'invalid' as any
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('Status must be "lead" or "customer"')
    })

    it('should track insert failures', async () => {
      mockSupabase.is.mockReturnValue(
        Promise.resolve({ data: [], error: null })
      )

      mockSupabase.insert.mockReturnValue(
        Promise.resolve({ error: { message: 'Insert failed' } })
      )

      const contacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com'
        }
      ]

      const result = await importContactsFromCSV(contacts)

      expect(result.data.failed).toBe(1)
      expect(result.data.errors[0].error).toBe('Insert failed')
    })
  })

  describe('exportContactsToCSV', () => {
    it('should export contacts as CSV', async () => {
      const mockContacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '555-1234',
          company: 'Acme Inc',
          title: 'Manager',
          status: 'lead',
          custom_fields: { Industry: 'Tech' },
          created_at: '2026-01-15T12:00:00Z'
        }
      ]

      mockSupabase.or.mockReturnThis()
      mockSupabase.order.mockReturnValue(
        Promise.resolve({
          data: mockContacts,
          error: null
        })
      )

      const result = await exportContactsToCSV()

      expect(result.error).toBeUndefined()
      expect(result.data.count).toBe(1)
      expect(result.data.csv).toContain('First Name')
      expect(result.data.csv).toContain('"John"')
      expect(result.data.csv).toContain('"Doe"')
      expect(result.data.csv).toContain('Industry')
      expect(result.data.csv).toContain('"Tech"')
    })

    it('should return error when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await exportContactsToCSV()

      expect(result.error).toBe('You must be logged in to export contacts')
    })

    it('should return error when no contacts found', async () => {
      mockSupabase.order.mockReturnValue(
        Promise.resolve({
          data: [],
          error: null
        })
      )

      const result = await exportContactsToCSV()

      expect(result.error).toBe('No contacts found to export')
    })

    it('should return error on database failure', async () => {
      mockSupabase.order.mockReturnValue(
        Promise.resolve({
          data: null,
          error: { message: 'Server error' }
        })
      )

      const result = await exportContactsToCSV()

      expect(result.error).toBe('Failed to fetch contacts for export')
    })

    it('should apply search filter', async () => {
      const mockContacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: null,
          company: null,
          title: null,
          status: 'lead',
          custom_fields: null,
          created_at: '2026-01-15T12:00:00Z'
        }
      ]

      // order() returns mockSupabase for further chaining, or() resolves with data
      mockSupabase.order.mockReturnThis()
      mockSupabase.or.mockReturnValue(
        Promise.resolve({
          data: mockContacts,
          error: null
        })
      )

      await exportContactsToCSV({ search: 'John' })

      expect(mockSupabase.or).toHaveBeenCalledWith(
        expect.stringContaining('John')
      )
    })

    it('should apply status filter', async () => {
      const mockContacts = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: null,
          company: null,
          title: null,
          status: 'lead',
          custom_fields: null,
          created_at: '2026-01-15T12:00:00Z'
        }
      ]

      // order() returns mockSupabase for further chaining, eq() resolves with data
      mockSupabase.order.mockReturnThis()
      mockSupabase.eq.mockReturnValue(
        Promise.resolve({
          data: mockContacts,
          error: null
        })
      )

      await exportContactsToCSV({ status: 'lead' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'lead')
    })
  })
})
