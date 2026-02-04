'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Activity {
  id: string
  type: 'call' | 'meeting' | 'email' | 'note' | 'task'
  subject: string
  description?: string
  contact_id?: string
  deal_id?: string
  owner_id: string
  assigned_to?: string
  status?: 'todo' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high'
  due_date?: string
  completed_at?: string
  duration_minutes?: number
  created_at: string
  updated_at: string
}

/**
 * Create a new activity
 */
export async function createActivity(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const type = formData.get('type') as Activity['type']
  const subject = formData.get('subject') as string
  const description = formData.get('description') as string
  const contact_id = formData.get('contact_id') as string
  const deal_id = formData.get('deal_id') as string
  const assigned_to = formData.get('assigned_to') as string
  const status = formData.get('status') as Activity['status']
  const priority = formData.get('priority') as Activity['priority']
  const due_date = formData.get('due_date') as string
  const duration_minutes = formData.get('duration_minutes') as string

  if (!type || !subject) {
    return { error: 'Type and subject are required' }
  }

  if (!contact_id && !deal_id) {
    return { error: 'Either contact_id or deal_id is required' }
  }

  const activityData: any = {
    type,
    subject,
    description: description || null,
    contact_id: contact_id || null,
    deal_id: deal_id || null,
    owner_id: user.id,
    assigned_to: assigned_to || user.id,
    status: status || 'todo',
    priority: priority || 'medium',
    due_date: due_date || null,
    duration_minutes: duration_minutes ? parseInt(duration_minutes) : null
  }

  const { data, error } = await supabase
    .from('activities')
    .insert(activityData)
    .select()
    .single()

  if (error) {
    console.error('Error creating activity:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (contact_id) {
    revalidatePath(`/contacts/${contact_id}`)
  }
  if (deal_id) {
    revalidatePath(`/deals/${deal_id}`)
  }
  revalidatePath('/activities')

  return { data, error: null }
}

/**
 * Update an existing activity
 */
export async function updateActivity(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const updates: any = {
    updated_at: new Date().toISOString()
  }

  const fields = ['subject', 'description', 'status', 'priority', 'due_date', 'assigned_to', 'duration_minutes', 'completed_at']

  fields.forEach(field => {
    const value = formData.get(field)
    if (value !== null) {
      if (field === 'duration_minutes') {
        updates[field] = value ? parseInt(value as string) : null
      } else {
        updates[field] = value || null
      }
    }
  })

  // Auto-set completed_at when status changes to completed
  if (updates.status === 'completed' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating activity:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (data.contact_id) {
    revalidatePath(`/contacts/${data.contact_id}`)
  }
  if (data.deal_id) {
    revalidatePath(`/deals/${data.deal_id}`)
  }
  revalidatePath('/activities')
  revalidatePath(`/activities/${id}`)

  return { data, error: null }
}

/**
 * Soft delete an activity
 */
export async function deleteActivity(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get activity details for revalidation
  const { data: activity } = await supabase
    .from('activities')
    .select('contact_id, deal_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('activities')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error deleting activity:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (activity?.contact_id) {
    revalidatePath(`/contacts/${activity.contact_id}`)
  }
  if (activity?.deal_id) {
    revalidatePath(`/deals/${activity.deal_id}`)
  }
  revalidatePath('/activities')

  return { error: null }
}

/**
 * Get activity by ID
 */
export async function getActivityById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title, amount),
      owner:users!activities_owner_id_fkey(id, email),
      assignee:users!activities_assigned_to_fkey(id, email)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching activity:', error)
    return null
  }

  return data
}

/**
 * Get activities for a contact
 */
export async function getActivitiesForContact(contactId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      owner:users!activities_owner_id_fkey(id, email),
      assignee:users!activities_assigned_to_fkey(id, email)
    `)
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contact activities:', error)
    return []
  }

  return data || []
}

/**
 * Get activities for a deal
 */
export async function getActivitiesForDeal(dealId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      contact:contacts(id, first_name, last_name),
      owner:users!activities_owner_id_fkey(id, email),
      assignee:users!activities_assigned_to_fkey(id, email)
    `)
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching deal activities:', error)
    return []
  }

  return data || []
}

/**
 * Update activity status (for drag-and-drop)
 */
export async function updateActivityStatus(
  id: string,
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  const updates: Record<string, string | null> = {
    status,
    updated_at: new Date().toISOString()
  }

  // Auto-set completed_at when status changes to completed
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  } else {
    updates.completed_at = null
  }

  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', id)
    .select('id, contact_id, deal_id')
    .single()

  if (error) {
    console.error('Error updating activity status:', error)
    return { error: error.message }
  }

  // Revalidate relevant pages
  if (data.contact_id) {
    revalidatePath(`/contacts/${data.contact_id}`)
  }
  if (data.deal_id) {
    revalidatePath(`/deals/${data.deal_id}`)
  }
  revalidatePath('/tasks')
  revalidatePath('/activities')

  return { data, error: null }
}

/**
 * Get tasks assigned to current user
 */
export async function getUserTasks(filters?: {
  status?: Activity['status']
  overdue?: boolean
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  let query = supabase
    .from('activities')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, company),
      deal:deals(id, title, amount)
    `)
    .eq('type', 'task')
    .eq('assigned_to', user.id)
    .is('deleted_at', null)

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.overdue) {
    query = query
      .lt('due_date', new Date().toISOString())
      .neq('status', 'completed')
  }

  query = query.order('due_date', { ascending: true, nullsFirst: false })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching user tasks:', error)
    return []
  }

  return data || []
}