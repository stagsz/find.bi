import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TimeEntryForm from '@/components/timer/TimeEntryForm'

// Mock the server actions
const mockCreateTimeEntry = vi.fn()
const mockUpdateTimeEntry = vi.fn()

vi.mock('@/app/time-entries/actions', () => ({
  createTimeEntry: (...args: unknown[]) => mockCreateTimeEntry(...args),
  updateTimeEntry: (...args: unknown[]) => mockUpdateTimeEntry(...args),
}))

describe('TimeEntryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateTimeEntry.mockResolvedValue({ data: { id: '1' }, error: null })
    mockUpdateTimeEntry.mockResolvedValue({ data: { id: '1' }, error: null })
  })

  describe('Rendering', () => {
    it('should render all form fields in create mode', () => {
      render(<TimeEntryForm />)

      expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/billable/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /log time/i })).toBeInTheDocument()
    })

    it('should show "Update Entry" button in edit mode', () => {
      render(
        <TimeEntryForm
          mode="edit"
          timeEntry={{
            id: 'te-1',
            duration_minutes: 90,
            entry_date: '2026-02-05',
            notes: 'Test notes',
            is_billable: true,
          }}
        />
      )

      expect(screen.getByRole('button', { name: /update entry/i })).toBeInTheDocument()
    })

    it('should render cancel button when onCancel is provided', () => {
      const onCancel = vi.fn()
      render(<TimeEntryForm onCancel={onCancel} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should not render cancel button when onCancel is not provided', () => {
      render(<TimeEntryForm />)

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })

    it('should show duration hint text', () => {
      render(<TimeEntryForm />)

      expect(screen.getByText(/enter as hours:minutes/i)).toBeInTheDocument()
    })
  })

  describe('Initial values', () => {
    it('should pre-populate duration from initialSeconds', () => {
      // 5400 seconds = 90 minutes = 1:30
      render(<TimeEntryForm initialSeconds={5400} />)

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      expect(durationInput.value).toBe('1:30')
    })

    it('should ceil initialSeconds to next minute', () => {
      // 61 seconds = ceil to 2 minutes = 0:02
      render(<TimeEntryForm initialSeconds={61} />)

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      expect(durationInput.value).toBe('0:02')
    })

    it('should pre-populate duration from timeEntry in edit mode', () => {
      render(
        <TimeEntryForm
          mode="edit"
          timeEntry={{
            id: 'te-1',
            duration_minutes: 150,
            entry_date: '2026-02-05',
            is_billable: true,
          }}
        />
      )

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      expect(durationInput.value).toBe('2:30')
    })

    it('should pre-populate notes from timeEntry in edit mode', () => {
      render(
        <TimeEntryForm
          mode="edit"
          timeEntry={{
            id: 'te-1',
            duration_minutes: 30,
            entry_date: '2026-02-05',
            notes: 'Existing note',
            is_billable: true,
          }}
        />
      )

      const notesInput = screen.getByLabelText(/notes/i) as HTMLTextAreaElement
      expect(notesInput.defaultValue).toBe('Existing note')
    })

    it('should default billable checkbox to checked in create mode', () => {
      render(<TimeEntryForm />)

      const checkbox = screen.getByLabelText(/billable/i) as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('should respect is_billable from timeEntry in edit mode', () => {
      render(
        <TimeEntryForm
          mode="edit"
          timeEntry={{
            id: 'te-1',
            duration_minutes: 30,
            entry_date: '2026-02-05',
            is_billable: false,
          }}
        />
      )

      const checkbox = screen.getByLabelText(/billable/i) as HTMLInputElement
      expect(checkbox.checked).toBe(false)
    })

    it('should leave duration empty when no initialSeconds or timeEntry', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      expect(durationInput.value).toBe('')
    })
  })

  describe('Duration validation', () => {
    it('should show error for invalid duration format on change', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: 'abc' } })

      expect(screen.getByText(/enter a valid duration/i)).toBeInTheDocument()
    })

    it('should show error for zero duration on change', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '0' } })

      expect(screen.getByText(/enter a valid duration/i)).toBeInTheDocument()
    })

    it('should show error for negative duration on change', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '-5' } })

      expect(screen.getByText(/enter a valid duration/i)).toBeInTheDocument()
    })

    it('should clear error when valid duration is entered', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)

      fireEvent.change(durationInput, { target: { value: 'abc' } })
      expect(screen.getByText(/enter a valid duration/i)).toBeInTheDocument()

      fireEvent.change(durationInput, { target: { value: '30' } })
      expect(screen.queryByText(/enter a valid duration/i)).not.toBeInTheDocument()
    })

    it('should not show error for empty input (clear state)', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '' } })

      expect(screen.queryByText(/enter a valid duration/i)).not.toBeInTheDocument()
    })

    it('should accept HH:MM format', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '2:30' } })

      expect(screen.queryByText(/enter a valid duration/i)).not.toBeInTheDocument()
    })

    it('should accept plain minutes format', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '90' } })

      expect(screen.queryByText(/enter a valid duration/i)).not.toBeInTheDocument()
    })

    it('should accept decimal hours format', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '1.5' } })

      expect(screen.queryByText(/enter a valid duration/i)).not.toBeInTheDocument()
    })

    it('should show duration error on submit with empty duration', async () => {
      render(<TimeEntryForm />)

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText(/enter a valid duration/i)).toBeInTheDocument()
      })
      expect(mockCreateTimeEntry).not.toHaveBeenCalled()
    })
  })

  describe('Form interactions', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn()
      render(<TimeEntryForm onCancel={onCancel} />)

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('should update duration input value on change', () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement
      fireEvent.change(durationInput, { target: { value: '45' } })

      expect(durationInput.value).toBe('45')
    })
  })

  describe('Form submission - create mode', () => {
    it('should call createTimeEntry with correct FormData', async () => {
      const onSuccess = vi.fn()
      render(<TimeEntryForm contactId="c-1" dealId="d-1" onSuccess={onSuccess} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '1:30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateTimeEntry).toHaveBeenCalledTimes(1)
      })

      const formData = mockCreateTimeEntry.mock.calls[0][0] as FormData
      expect(formData.get('duration_minutes')).toBe('90')
      expect(formData.get('contact_id')).toBe('c-1')
      expect(formData.get('deal_id')).toBe('d-1')
    })

    it('should call onSuccess after successful create', async () => {
      const onSuccess = vi.fn()
      render(<TimeEntryForm onSuccess={onSuccess} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
    })

    it('should display error from server action on failed create', async () => {
      mockCreateTimeEntry.mockResolvedValue({ error: 'Server error occurred' })
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Server error occurred')).toBeInTheDocument()
      })
    })

    it('should not call onSuccess when server action returns error', async () => {
      mockCreateTimeEntry.mockResolvedValue({ error: 'Failed' })
      const onSuccess = vi.fn()
      render(<TimeEntryForm onSuccess={onSuccess} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('should include activityId when provided', async () => {
      render(<TimeEntryForm activityId="a-1" />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '60' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateTimeEntry).toHaveBeenCalledTimes(1)
      })

      const formData = mockCreateTimeEntry.mock.calls[0][0] as FormData
      expect(formData.get('activity_id')).toBe('a-1')
    })

    it('should set is_billable to true when checkbox is checked', async () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateTimeEntry).toHaveBeenCalledTimes(1)
      })

      const formData = mockCreateTimeEntry.mock.calls[0][0] as FormData
      expect(formData.get('is_billable')).toBe('true')
    })

    it('should set is_billable to false when checkbox is unchecked', async () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const checkbox = screen.getByLabelText(/billable/i)
      fireEvent.click(checkbox)

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateTimeEntry).toHaveBeenCalledTimes(1)
      })

      const formData = mockCreateTimeEntry.mock.calls[0][0] as FormData
      expect(formData.get('is_billable')).toBe('false')
    })

    it('should parse decimal hours correctly in submission', async () => {
      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '2.5' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockCreateTimeEntry).toHaveBeenCalledTimes(1)
      })

      const formData = mockCreateTimeEntry.mock.calls[0][0] as FormData
      expect(formData.get('duration_minutes')).toBe('150')
    })
  })

  describe('Form submission - edit mode', () => {
    const timeEntry = {
      id: 'te-1',
      duration_minutes: 90,
      entry_date: '2026-02-05',
      notes: 'Original notes',
      is_billable: true,
    }

    it('should call updateTimeEntry with entry ID and FormData', async () => {
      const onSuccess = vi.fn()
      render(<TimeEntryForm mode="edit" timeEntry={timeEntry} onSuccess={onSuccess} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '2:00' } })

      const form = screen.getByRole('button', { name: /update entry/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockUpdateTimeEntry).toHaveBeenCalledTimes(1)
      })

      expect(mockUpdateTimeEntry.mock.calls[0][0]).toBe('te-1')
      const formData = mockUpdateTimeEntry.mock.calls[0][1] as FormData
      expect(formData.get('duration_minutes')).toBe('120')
    })

    it('should call onSuccess after successful update', async () => {
      const onSuccess = vi.fn()
      render(<TimeEntryForm mode="edit" timeEntry={timeEntry} onSuccess={onSuccess} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '60' } })

      const form = screen.getByRole('button', { name: /update entry/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
    })

    it('should display error from server action on failed update', async () => {
      mockUpdateTimeEntry.mockResolvedValue({ error: 'Cannot edit approved time entries' })
      render(<TimeEntryForm mode="edit" timeEntry={timeEntry} />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '60' } })

      const form = screen.getByRole('button', { name: /update entry/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Cannot edit approved time entries')).toBeInTheDocument()
      })
    })
  })

  describe('Loading state', () => {
    it('should show "Saving..." while submitting', async () => {
      // Make the action hang so we can observe loading state
      let resolveAction: (value: unknown) => void
      mockCreateTimeEntry.mockReturnValue(
        new Promise((resolve) => { resolveAction = resolve })
      )

      render(<TimeEntryForm />)

      const durationInput = screen.getByLabelText(/duration/i)
      fireEvent.change(durationInput, { target: { value: '30' } })

      const form = screen.getByRole('button', { name: /log time/i }).closest('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

      // Resolve to clean up
      resolveAction!({ data: { id: '1' }, error: null })
      await waitFor(() => {
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument()
      })
    })
  })
})
