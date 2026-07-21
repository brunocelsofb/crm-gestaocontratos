'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export async function saveLostReason(formData: FormData): Promise<{ error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só admins.' }
  const supabase = await createClient()
  const id = formData.get('id') as string | null
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Nome obrigatório.' }
  if (id) {
    const { error } = await supabase.from('lost_reasons').update({ name }).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('lost_reasons').insert({ name })
    if (error) return { error: error.message }
  }
  revalidatePath('/settings/motivos-perda')
  return {}
}

export async function toggleLostReason(id: string, active: boolean): Promise<{ error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só admins.' }
  const supabase = await createClient()
  const { error } = await supabase.from('lost_reasons').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/settings/motivos-perda')
  return {}
}

export async function deleteLostReason(id: string): Promise<{ error?: string }> {
  if (!(await isCurrentUserAdmin())) return { error: 'Só admins.' }
  const supabase = await createClient()
  const { error } = await supabase.from('lost_reasons').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/settings/motivos-perda')
  return {}
}
