import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')
  const withStages = searchParams.get('withStages') === 'true'
  const supabase = await createClient()

  if (pipelineId) {
    // Busca stages de um pipeline específico
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name')
      .eq('pipeline_id', pipelineId)
      .order('position')
    return NextResponse.json({ stages: data ?? [] })
  }

  if (withStages) {
    // Carrega todos os pipelines com suas stages de uma vez
    const { data } = await supabase
      .from('pipelines')
      .select('id, name, pipeline_stages(id, name, position)')
      .order('name')
    const pipelines = (data ?? []).map((p: any) => ({
      ...p,
      pipeline_stages: [...(p.pipeline_stages ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
    }))
    return NextResponse.json({ pipelines })
  }

  const { data } = await supabase.from('pipelines').select('id, name').order('name')
  return NextResponse.json({ pipelines: data ?? [] })
}
