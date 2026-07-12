'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type Question = {
  id: string
  type: 'text' | 'textarea' | 'single_choice' | 'multiple_choice' | 'rating' | 'likert'
  label: string
  options?: string[]
}

export type ActionState = { error?: string }

export async function createSurveyTemplate(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const questionsRaw = formData.get('questions') as string
  const tag_id = (formData.get('tag_id') as string) || null

  if (!name) return { error: 'Nome do formulário é obrigatório.' }

  let questions: Question[]
  try {
    questions = JSON.parse(questionsRaw)
  } catch {
    return { error: 'Falha ao processar as perguntas.' }
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return { error: 'Adicione pelo menos uma pergunta.' }
  }

  const { error } = await supabase.from('survey_templates').insert({
    name,
    questions,
    tag_id,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/surveys')
  return {}
}

export async function updateSurveyTemplate(
  templateId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const questionsRaw = formData.get('questions') as string
  const tag_id = (formData.get('tag_id') as string) || null

  if (!name) return { error: 'Nome do formulário é obrigatório.' }

  let questions: Question[]
  try {
    questions = JSON.parse(questionsRaw)
  } catch {
    return { error: 'Falha ao processar as perguntas.' }
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return { error: 'Adicione pelo menos uma pergunta.' }
  }

  const { error } = await supabase
    .from('survey_templates')
    .update({ name, questions, tag_id })
    .eq('id', templateId)

  if (error) return { error: error.message }

  revalidatePath('/surveys')
  redirect('/surveys')
}

export async function duplicateSurveyTemplate(templateId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: original } = await supabase
    .from('survey_templates')
    .select('name, questions, tag_id')
    .eq('id', templateId)
    .single()

  if (!original) return

  await supabase.from('survey_templates').insert({
    name: `${original.name} (cópia)`,
    questions: original.questions,
    tag_id: original.tag_id,
    created_by: user.id,
  })

  revalidatePath('/surveys')
}

export async function deleteSurveyTemplate(templateId: string) {
  const supabase = await createClient()
  await supabase.from('survey_templates').delete().eq('id', templateId)
  revalidatePath('/surveys')
}

export async function sendCustomSurvey(contractId: string, templateId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const token = crypto.randomUUID()

  await supabase.from('custom_surveys').insert({
    contract_id: contractId,
    template_id: templateId,
    token,
    created_by: user.id,
  })

  revalidatePath(`/contracts/${contractId}`)
}

export type SubmitCustomSurveyResult = { success: true } | { error: string }

export async function submitCustomSurveyResponse(
  token: string,
  formData: FormData
): Promise<SubmitCustomSurveyResult> {
  const respondent_name = (formData.get('respondent_name') as string)?.trim()
  const respondent_email = (formData.get('respondent_email') as string)?.trim()
  const respondent_phone = (formData.get('respondent_phone') as string)?.trim()
  const responsesRaw = formData.get('responses') as string

  if (!respondent_name) return { error: 'Informe seu nome.' }
  if (!respondent_email) return { error: 'Informe seu e-mail.' }
  if (!respondent_phone) return { error: 'Informe seu telefone.' }

  let responses: Record<string, string | string[]>
  try {
    responses = JSON.parse(responsesRaw)
  } catch {
    return { error: 'Falha ao processar as respostas.' }
  }

  const adminClient = createAdminClient()

  const { data: survey } = await adminClient
    .from('custom_surveys')
    .select('id, status')
    .eq('token', token)
    .maybeSingle()

  if (!survey) return { error: 'Link inválido ou expirado.' }
  if (survey.status === 'answered') return { error: 'Este formulário já foi respondido.' }

  const { error } = await adminClient
    .from('custom_surveys')
    .update({
      responses,
      respondent_name,
      respondent_email,
      respondent_phone,
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('id', survey.id)

  if (error) return { error: error.message }

  return { success: true }
}
