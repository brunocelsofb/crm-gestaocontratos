import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'member'

export async function getCurrentProfile(): Promise<{ id: string; role: UserRole } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return { id: profile.id, role: profile.role as UserRole }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile()
  return profile?.role === 'admin'
}
