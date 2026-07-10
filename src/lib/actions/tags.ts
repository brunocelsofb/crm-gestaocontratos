'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionState = { error?: string }

export async function createTag(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const name = (formData.get('name') as string)?.trim()
  const color = (formData.get('color') as string) || '#6B7280'

  if (!name) return { error: 'Nome é obrigatório.' }

  const { error } = await supabase.from('tags').insert({ name, color })

  if (error) {
    if (error.code === '23505') return { error: 'Já existe uma tag com esse nome.' }
    return { error: error.message }
  }

  revalidatePath('/tags')
  return {}
}

export async function deleteTag(tagId: string) {
  const supabase = await createClient()
  await supabase.from('tags').delete().eq('id', tagId)
  revalidatePath('/tags')
}

export async function setContractTag(contractId: string, formData: FormData) {
  const supabase = await createClient()
  const tagId = (formData.get('tag_id') as string) || null

  // Modelo simples por enquanto: um contrato tem no máximo uma tag de
  // produto por vez — remove a anterior antes de adicionar a nova.
  await supabase.from('contract_tags').delete().eq('contract_id', contractId)

  if (tagId) {
    await supabase.from('contract_tags').insert({ contract_id: contractId, tag_id: tagId })
  }

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
}
