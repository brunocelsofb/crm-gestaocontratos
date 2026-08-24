import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const pipelineId = searchParams.get('pipelineId')
    const withStages = searchParams.get('withStages') === 'true'
    const supabase = await createClient()

    if (pipelineId) {
      // Stages de um pipeline específico
      const { data, error } = await supabase
        .from('stages')
        .select('id, name, pipeline_id')
        .eq('pipeline_id', pipelineId)
        .order('order_index')
      if (error) console.error('[pipelines-list]', error.message)
      return NextResponse.json({ stages: data ?? [] })
    }

    if (withStages) {
      // Pipelines + todas as stages em paralelo
      const [{ data: pipelines, error: pe }, { data: stages, error: se }] = await Promise.all([
        supabase.from('pipelines').select('id, name').order('name'),
        supabase.from('stages').select('id, name, pipeline_id').order('order_index'),
      ])
      if (pe) console.error('[pipelines-list] pipelines:', pe.message)
      if (se) console.error('[pipelines-list] stages:', se.message)

      // Monta pipeline_stages para compatibilidade com o modal
      const ps = (pipelines ?? []).map((p: any) => ({
        ...p,
        pipeline_stages: (stages ?? []).filter((s: any) => s.pipeline_id === p.id),
      }))
      console.log('[pipelines-list] pipelines:', ps.length, '| stages:', stages?.length ?? 0)
      return NextResponse.json({ pipelines: ps, stages: stages ?? [] })
    }

    const { data } = await supabase.from('pipelines').select('id, name').order('name')
    return NextResponse.json({ pipelines: data ?? [] })

  } catch (e: any) {
    console.error('[pipelines-list] erro:', e.message)
    return NextResponse.json({ pipelines: [], stages: [] })
  }
}
