'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/auth/permissions'

export interface TimeEntry {
  id: string
  user_id: string
  contact_id?: string
  deal_id?: string
  activity_id?: string
  duration_minutes: number
  entry_date: string
  notes?: string
  is_billable: boolean
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approval_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
}

/**
 * Create a new time entry
 */
export async function createTimeEntry(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const contact_id = formData.get('contact_id') as string
  const deal_id = formData.get('deal_id') as string
  const activity_id = formData.get('activity_id') as string
  const duration_minutes = formData.get('duration_minutes') as string
  const entry_date = formData.get('entry_date') as string
  const notes = formData.get('notes') as string
  const is_billable = formData.get('is_billable') === 'true'

  // Validate required fields
  if (!duration_minutes || parseInt(duration_minutes) <= 0) {
    return { error: 'Duration must be greater than 0' }
  }

  if (!entry_date) {
    return { error: 'Entry date is required' }
  }

  const timeEntryData = {
    user_id: user.id,
    contact_id: contact_id || null,
    deal_id: deal_id || null,
    activity_id: activity_id || null,
    duration_minutes: parseInt(duration_minutes),
    entry_date,
    notes: notes || null,
    is_billable,
    status: 'draft' as const
  }

  const { data, error } = await supabase
    .from('time_entries')
    .insert(timeEntryData)
    .select()
    .single()

  if (error) {
    console.error('Error creating time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (contact_id) {
    revalidatePath(`/contacts/${contact_id}`)
  }
  if (deal_id) {
    revalidatePath(`/deals/${deal_id}`)
  }
  revalidatePath('/time-entries')

  return { data, error: null }
}

/**
 * Update an existing time entry
 */
export async function updateTimeEntry(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get the existing time entry to check status
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, user_id, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'Time entry not found' }
  }

  // Verify ownership - users can only edit their own entries
  if (existing.user_id !== user.id) {
    return { error: 'You can only edit your own time entries' }
  }

  // Prevent editing approved or submitted entries
  // Only draft and rejected entries can be edited
  if (existing.status === 'approved') {
    return { error: 'Cannot edit approved time entries' }
  }

  if (existing.status === 'submitted') {
    return { error: 'Cannot edit time entries pending approval. Please wait for admin review or ask to have it rejected.' }
  }

  const duration_minutes = formData.get('duration_minutes') as string
  const entry_date = formData.get('entry_date') as string
  const notes = formData.get('notes') as string
  const is_billable = formData.get('is_billable') === 'true'

  // Validate required fields
  if (!duration_minutes || parseInt(duration_minutes) <= 0) {
    return { error: 'Duration must be greater than 0' }
  }

  if (!entry_date) {
    return { error: 'Entry date is required' }
  }

  const updates = {
    duration_minutes: parseInt(duration_minutes),
    entry_date,
    notes: notes || null,
    is_billable,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
  }
  if (existing.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
  }
  revalidatePath('/time-entries')
  revalidatePath(`/time-entries/${id}`)

  return { data, error: null }
}

/**
 * Delete a time entry (only draft entries can be deleted)
 */
export async function deleteTimeEntry(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get the existing time entry
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, user_id, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'Time entry not found' }
  }

  // Only allow deletion of draft entries (RLS enforces user ownership)
  if (existing.status !== 'draft') {
    return { error: 'Only draft time entries can be deleted' }
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
  }
  if (existing.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
  }
  revalidatePath('/time-entries')

  return { error: null }
}

/**
 * Get time entries for a contact
 */
export async function getTimeEntriesForContact(contactId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      user:users(id, email),
      activity:activities(id, subject, type)
    `)
    .eq('contact_id', contactId)
    .order('entry_date', { ascending: false })

  if (error) {
    console.error('Error fetching time entries for contact:', error)
    return []
  }

  return data || []
}

/**
 * Get time entries for a deal
 */
export async function getTimeEntriesForDeal(dealId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      user:users(id, email),
      activity:activities(id, subject, type)
    `)
    .eq('deal_id', dealId)
    .order('entry_date', { ascending: false })

  if (error) {
    console.error('Error fetching time entries for deal:', error)
    return []
  }

  return data || []
}

/**
 * Submit a time entry for approval (changes status from 'draft' or 'rejected' to 'submitted')
 * When resubmitting a rejected entry, clears the previous rejection notes
 */
export async function submitTimeEntry(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get the existing time entry
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, user_id, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'Time entry not found' }
  }

  // Only the owner can submit their time entry
  if (existing.user_id !== user.id) {
    return { error: 'You can only submit your own time entries' }
  }

  // Only draft and rejected entries can be submitted
  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    return { error: 'Only draft or rejected time entries can be submitted for approval' }
  }

  // When resubmitting, clear rejection notes and approval info
  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'submitted',
      approval_notes: null,
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error submitting time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
  }
  if (existing.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
  }
  revalidatePath('/time-entries')
  revalidatePath(`/time-entries/${id}`)

  return { data, error: null }
}

/**
 * Get time entries for the current user
 */
export async function getUserTimeEntries(filters?: {
  status?: TimeEntry['status']
  startDate?: string
  endDate?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  let query = supabase
    .from('time_entries')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title, amount),
      activity:activities(id, subject, type)
    `)
    .eq('user_id', user.id)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.startDate) {
    query = query.gte('entry_date', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('entry_date', filters.endDate)
  }

  query = query.order('entry_date', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching user time entries:', error)
    return []
  }

  return data || []
}

/**
 * Approve a time entry (admin only)
 * Changes status from 'submitted' to 'approved'
 */
export async function approveTimeEntry(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Only admins can approve time entries
  const adminCheck = await isAdmin()
  if (!adminCheck) {
    return { error: 'Only admins can approve time entries' }
  }

  // Get the existing time entry
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'Time entry not found' }
  }

  // Only submitted entries can be approved
  if (existing.status !== 'submitted') {
    return { error: 'Only submitted time entries can be approved' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error approving time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
  }
  if (existing.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
  }
  revalidatePath('/time-entries')
  revalidatePath('/admin/time-approvals')

  return { data, error: null }
}

/**
 * Reject a time entry (admin only)
 * Changes status from 'submitted' to 'rejected' with optional notes
 */
export async function rejectTimeEntry(id: string, notes?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Only admins can reject time entries
  const adminCheck = await isAdmin()
  if (!adminCheck) {
    return { error: 'Only admins can reject time entries' }
  }

  // Get the existing time entry
  const { data: existing } = await supabase
    .from('time_entries')
    .select('status, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return { error: 'Time entry not found' }
  }

  // Only submitted entries can be rejected
  if (existing.status !== 'submitted') {
    return { error: 'Only submitted time entries can be rejected' }
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error rejecting time entry:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
  }
  if (existing.deal_id) {
    revalidatePath(`/deals/${existing.deal_id}`)
  }
  revalidatePath('/time-entries')
  revalidatePath('/admin/time-approvals')

  return { data, error: null }
}
