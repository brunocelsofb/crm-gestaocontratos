// Funções de LEITURA — sem 'use server', podem ser chamadas em Server Components
import { createAdminClient } from '@/lib/supabase/admin'

export type FieldVisibility = 'required' | 'optional' | 'hidden'

export type PipelineFieldConfig = {
  field_key: string
  field_label: string
  visibility: FieldVisibility
  display_order: number
}

export const FIXED_FIELDS: Omit<PipelineFieldConfig, 'visibility'>[] = [
  { field_key: 'title',               field_label: 'Título da oportunidade', display_order: 0 },
  { field_key: 'value',               field_label: 'Valor estimado',          display_order: 1 },
  { field_key: 'expected_close_date', field_label: 'Previsão de fechamento',  display_order: 2 },
  { field_key: 'source',              field_label: 'Origem da negociação',    display_order: 3 },
  { field_key: 'contact_name',        field_label: 'Nome do contato',         display_order: 4 },
  { field_key: 'contact_email',       field_label: 'E-mail do contato',       display_order: 5 },
  { field_key: 'contact_phone',       field_label: 'Telefone do contato',     display_order: 6 },
  { field_key: 'description',         field_label: 'Descrição / Observação',  display_order: 7 },
]

export async function getPipelineFieldConfigs(pipelineId: string): Promise<PipelineFieldConfig[]> {
  const supabase = createAdminClient()
  const [{ data: savedConfigs }, { data: customFields }] = await Promise.all([
    supabase.from('pipeline_field_configs').select('*').eq('pipeline_id', pipelineId).order('display_order'),
    supabase.from('custom_fields').select('id, name, field_key').order('name'),
  ])
  const savedMap = new Map((savedConfigs ?? []).map((c: any) => [c.field_key, c]))
  const allFields: PipelineFieldConfig[] = [
    ...FIXED_FIELDS.map(f => ({
      ...f,
      visibility: (savedMap.get(f.field_key)?.visibility ?? (f.field_key === 'title' ? 'required' : 'optional')) as FieldVisibility,
      display_order: savedMap.get(f.field_key)?.display_order ?? f.display_order,
    })),
    ...(customFields ?? []).map((cf: any, idx: number) => ({
      field_key: cf.field_key,
      field_label: cf.name,
      visibility: (savedMap.get(cf.field_key)?.visibility ?? 'optional') as FieldVisibility,
      display_order: savedMap.get(cf.field_key)?.display_order ?? (100 + idx),
    })),
  ]
  return allFields.sort((a, b) => a.display_order - b.display_order)
}
