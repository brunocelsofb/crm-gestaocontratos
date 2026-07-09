'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createNpsSurvey(contractId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const token = crypto.randomUUID()

  await supabase.from('nps_surveys').insert({
    contract_id: contractId,
    token,
    created_by: user.id,
  })

  revalidatePath(`/contracts/${contractId}`)
}

export type SubmitNpsResult =
  | { success: true }
  | { error: string }

// Usada pela página PÚBLICA (sem login) — por isso usa o cliente admin
// (service_role), que ignora RLS. A validação de segurança acontece aqui
// em código, não em política de banco: só aceitamos a resposta se o token
// existir e a pesquisa ainda estiver pendente (evita responder duas vezes
// ou adulterar uma pesquisa já respondida).
export async function submitNpsResponse(
  token: string,
  formData: FormData
): Promise<SubmitNpsResult> {
  const scoreRaw = formData.get('score') as string
  const comment = (formData.get('comment') as string) || null

  const score = Number(scoreRaw)
  if (Number.isNaN(score) || score < 0 || score > 10) {
    return { error: 'Selecione uma nota de 0 a 10.' }
  }

  const adminClient = createAdminClient()

  const { data: survey } = await adminClient
    .from('nps_surveys')
    .select('id, status')
    .eq('token', token)
    .maybeSingle()

  if (!survey) return { error: 'Link inválido ou expirado.' }
  if (survey.status === 'answered') return { error: 'Esta pesquisa já foi respondida.' }

  const { error } = await adminClient
    .from('nps_surveys')
    .update({ score, comment, status: 'answered', answered_at: new Date().toISOString() })
    .eq('id', survey.id)

  if (error) return { error: error.message }

  return { success: true }
}
