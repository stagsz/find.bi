'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/permissions'

export type UserRole = 'admin' | 'user'

interface UpdateUserRoleResult {
  success: boolean
  error?: string
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<UpdateUserRoleResult> {
  // Verify the current user is an admin
  const currentUser = await requireAdmin()

  // Prevent admins from demoting themselves
  if (currentUser.id === userId) {
    return {
      success: false,
      error: 'You cannot change your own role',
    }
  }

  // Validate the role
  if (newRole !== 'admin' && newRole !== 'user') {
    return {
      success: false,
      error: 'Invalid role. Must be "admin" or "user"',
    }
  }

  const supabase = await createClient()

  // Verify target user exists
  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (fetchError || !targetUser) {
    return {
      success: false,
      error: 'User not found',
    }
  }

  // Skip if role is already the same
  if (targetUser.role === newRole) {
    return { success: true }
  }

  // Update the role
  const { error: updateError } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('id', userId)

  if (updateError) {
    return {
      success: false,
      error: updateError.message,
    }
  }

  revalidatePath('/admin')

  return { success: true }
}
