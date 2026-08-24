import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const pipelineId = searchParams.get('pipelineId')
  const supabase = await createClient()

  if (pipelineId) {
    const { data } = await supabase.from('pipeline_stages').select('id, name').eq('pipeline_id', pipelineId).order('position')
    return NextResponse.json({ stages: data ?? [] })
  }

  const { data } = await supabase.from('pipelines').select('id, name').order('name')
  return NextResponse.json({ pipelines: data ?? [] })
}
