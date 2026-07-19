'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PipelineFieldConfig } from '@/lib/pipeline-field-config'

export async function savePipelineFieldConfigs(
  pipelineId: string,
  configs: PipelineFieldConfig[]
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const rows = configs.map((c, idx) => ({
    pipeline_id: pipelineId,
    field_key: c.field_key,
    field_label: c.field_label,
    visibility: c.visibility,
    display_order: idx,
  }))
  const { error } = await supabase
    .from('pipeline_field_configs')
    .upsert(rows, { onConflict: 'pipeline_id,field_key' })
  if (error) return { error: error.message }
  revalidatePath('/settings/campos-oportunidade')
  revalidatePath('/contracts/new')
  return {}
}
