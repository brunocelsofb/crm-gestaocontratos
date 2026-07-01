'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'

export async function updateUserRole(targetUserId: string, formData: FormData) {
  const currentProfile = await getCurrentProfile()
  if (currentProfile?.role !== 'admin') return

  // Proteção extra: não deixa o admin remover o próprio acesso de admin
  // por engano, ficando sem ninguém com permissão para reverter.
  if (targetUserId === currentProfile.id) return

  const newRole = (formData.get('role') as string) === 'admin' ? 'admin' : 'member'

  const supabase = await createClient()
  await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId)

  revalidatePath('/users')
}
