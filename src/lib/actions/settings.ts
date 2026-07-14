'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export type ActionState = { error?: string }

export async function updateOrganizationLogo(filePath: string): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) {
    return { error: 'Só administradores podem alterar o logo.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({ logo_storage_path: filePath, updated_at: new Date().toISOString() })
    .eq('id', 'default')

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function updateOrganizationSettings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (!(await isCurrentUserAdmin())) {
    return { error: 'Só administradores podem alterar as configurações gerais.' }
  }

  const name = (formData.get('name') as string)?.trim()
  const company_name = (formData.get('company_name') as string)?.trim() || null
  const proposal_header_text = (formData.get('proposal_header_text') as string)?.trim() || null
  const proposal_footer_text = (formData.get('proposal_footer_text') as string)?.trim() || null
  const proposal_brand_color = (formData.get('proposal_brand_color') as string)?.trim() || '#1B556B'
  const assistantBudgetRaw = formData.get('assistant_monthly_budget_usd') as string
  const assistant_monthly_budget_usd = assistantBudgetRaw ? Number(assistantBudgetRaw) : 10
  if (!name) return { error: 'Nome é obrigatório.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_settings')
    .update({
      name,
      company_name,
      proposal_header_text,
      proposal_footer_text,
      proposal_brand_color,
      assistant_monthly_budget_usd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}
