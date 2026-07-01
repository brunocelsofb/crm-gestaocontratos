'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActivityActionState = { error?: string }

export async function createNote(
  _prevState: ActivityActionState,
  formData: FormData
): Promise<ActivityActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const contractId = formData.get('contract_id') as string
  const content = (formData.get('content') as string)?.trim()
  const type = (formData.get('type') as string) || 'note'

  if (!content) return { error: 'Escreva algo antes de salvar.' }

  const { error } = await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type,
    content,
  })

  if (error) return { error: error.message }

  revalidatePath(`/contracts/${contractId}`)
  return {}
}
