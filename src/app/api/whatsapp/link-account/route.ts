import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = await createClient()

  // Busca em contracts (oportunidades/contratos ativos)
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, title, client_name')
    .or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
    .limit(8)

  const results = (contracts ?? []).map(c => ({
    id: c.id,
    label: [c.client_name, c.title].filter(Boolean).join(' — '),
  }))

  console.log('[link-account] q:', q, '| results:', results.length)
  return NextResponse.json({ results })
}
