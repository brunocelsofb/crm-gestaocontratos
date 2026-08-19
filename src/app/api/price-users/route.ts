import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPriceAdminClient } from '@/lib/supabase/price'

async function checkAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  try {
    const price = createPriceAdminClient()

    // Busca usuários via Admin API
    const { data: { users }, error } = await price.auth.admin.listUsers()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Busca roles
    const { data: profiles } = await price.from('price_profiles').select('*')
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    const result = (users ?? []).map((u: any) => ({
      id: u.id,
      email: u.email,
      full_name: profileMap.get(u.id)?.full_name ?? u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? '',
      role: profileMap.get(u.id)?.role ?? 'reviewer',
      created_at: u.created_at,
    }))

    return NextResponse.json({ users: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { email, full_name, role, password } = await req.json()
  if (!email || !full_name || !role || !password) {
    return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
  }

  // Garante valores aceitos pela constraint price_profiles_role_check
  const validPriceRoles = ['admin', 'reviewer']
  const safeRole = validPriceRoles.includes(role) ? role : 'reviewer'

  try {
    const price = createPriceAdminClient()
    const { data: newUser, error } = await price.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: safeRole },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await price.from('price_profiles').upsert({
      id: newUser.user.id,
      full_name,
      role: safeRole,
      email,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, role, action, active } = await req.json()
  const price = createPriceAdminClient()

  if (action === 'toggle_active') {
    await price.auth.admin.updateUserById(id, {
      ban_duration: active ? 'none' : '87600h'
    })
    return NextResponse.json({ ok: true })
  }

  // Garante valores aceitos pela constraint price_profiles_role_check
  const validPriceRoles = ['admin', 'reviewer']
  const safeRole = validPriceRoles.includes(role) ? role : 'reviewer'
  await price.from('price_profiles').update({ role: safeRole }).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  const price = createPriceAdminClient()
  await price.auth.admin.deleteUser(id)
  return NextResponse.json({ ok: true })
}
