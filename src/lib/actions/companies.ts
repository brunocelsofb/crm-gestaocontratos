'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function findCompanyByCnpj(cnpjDigits: string) {
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, trade_name')
    .eq('cnpj', cnpjDigits)
    .maybeSingle()

  if (!company) return null

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role')
    .eq('company_id', company.id)
    .order('created_at')

  return { ...company, contacts: contacts ?? [] }
}

export async function createCompany(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const name = (formData.get('name') as string)?.trim()
  const trade_name = (formData.get('trade_name') as string) || null
  const cnpj = ((formData.get('cnpj') as string) || '').replace(/\D/g, '') || null
  const notes = (formData.get('notes') as string) || null

  if (!name) {
    return { fieldErrors: { name: ['Nome é obrigatório'] } }
  }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({ name, trade_name, cnpj, notes, owner_id: user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/companies')
  redirect(`/companies/${company.id}`)
}

export async function updateCompany(
  companyId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const trade_name = (formData.get('trade_name') as string) || null
  const cnpj = ((formData.get('cnpj') as string) || '').replace(/\D/g, '') || null
  const notes = (formData.get('notes') as string) || null

  if (!name) {
    return { fieldErrors: { name: ['Nome é obrigatório'] } }
  }

  const { error } = await supabase
    .from('companies')
    .update({ name, trade_name, cnpj, notes, updated_at: new Date().toISOString() })
    .eq('id', companyId)

  if (error) return { error: error.message }

  revalidatePath(`/companies/${companyId}`)
  redirect(`/companies/${companyId}`)
}

export async function createContact(
  companyId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string) || null
  const email = (formData.get('email') as string) || null
  const phone = (formData.get('phone') as string) || null

  if (!name) {
    return { fieldErrors: { name: ['Nome é obrigatório'] } }
  }

  const { error } = await supabase.from('contacts').insert({
    company_id: companyId,
    name,
    role,
    email,
    phone,
  })

  if (error) return { error: error.message }

  revalidatePath(`/companies/${companyId}`)
  return {}
}

export async function deleteContact(contactId: string, companyId: string) {
  const supabase = await createClient()
  await supabase.from('contacts').delete().eq('id', contactId)
  revalidatePath(`/companies/${companyId}`)
}
