import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const supabase = await createClient()

  const { data } = await supabase
    .from('contracts')
    .select('id, title, client_name')
    .or(`title.ilike.%${q}%,client_name.ilike.%${q}%`)
    .limit(10)

  return NextResponse.json({
    results: (data ?? []).map(c => ({
      id: c.id,
      label: c.client_name ? `${c.client_name} — ${c.title}` : c.title,
    }))
  })
}
