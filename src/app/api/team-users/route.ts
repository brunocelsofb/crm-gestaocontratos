import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
  return NextResponse.json({ users: data ?? [] })
}
