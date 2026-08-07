import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { activityId } = await params
  const admin = createAdminClient()

  // Toggle is_pinned
  const { data: current } = await admin
    .from('activities')
    .select('is_pinned')
    .eq('id', activityId)
    .maybeSingle()

  const newValue = !(current?.is_pinned ?? false)

  await admin.from('activities')
    .update({ is_pinned: newValue })
    .eq('id', activityId)

  return NextResponse.json({ is_pinned: newValue })
}
