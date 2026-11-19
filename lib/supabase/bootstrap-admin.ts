import 'server-only'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const USERS_PER_PAGE = 100

export async function bootstrapConfiguredAdmin(authUserId: string): Promise<boolean> {
  const configuredEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim()
  if (!configuredEmail) return false

  const parsedEmail = z.email().safeParse(configuredEmail)
  if (!parsedEmail.success) {
    throw new Error('ADMIN_BOOTSTRAP_EMAIL must contain a valid email address.')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(authUserId)
  if (error) throw error

  const user = data.user
  if (
    !user.email_confirmed_at ||
    user.email?.toLowerCase() !== parsedEmail.data.toLowerCase()
  ) {
    return false
  }

  if (user.app_metadata.role === 'admin') return true

  for (let page = 1; ; page += 1) {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    })
    if (usersError) throw usersError

    const existingAdmin = usersData.users.find(
      (candidate) => candidate.app_metadata.role === 'admin'
    )
    if (existingAdmin) return false
    if (usersData.users.length < USERS_PER_PAGE) break
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: 'admin' },
  })
  if (updateError) throw updateError

  // Sync profiles.role so RLS policies (which read profiles.role) see the admin.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id)
  if (profileError) throw profileError

  return true
}
