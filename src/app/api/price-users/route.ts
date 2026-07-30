import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PRICE_SUPABASE_URL = 'https://wcbxlqbpeodspoungwwz.supabase.co'
const PRICE_SERVICE_ROLE = process.env.PRICE_SUPABASE_SERVICE_ROLE_KEY!

// Lista usuários do Price
export async function GET() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Busca usuários do Price via Admin API
  const res = await fetch(`${PRICE_SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': PRICE_SERVICE_ROLE,
      'Authorization': `Bearer ${PRICE_SERVICE_ROLE}`,
    },
  })
  const { users } = await res.json()

  // Busca roles da tabela price_profiles
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const priceAdmin = createSupabaseClient(PRICE_SUPABASE_URL, PRICE_SERVICE_ROLE)
  const { data: profiles } = await priceAdmin.from('price_profiles').select('*')
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const result = (users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    full_name: profileMap.get(u.id)?.full_name ?? u.email?.split('@')[0] ?? '',
    role: profileMap.get(u.id)?.role ?? 'reviewer',
    created_at: u.created_at,
  }))

  return NextResponse.json({ users: result })
}

// Cria usuário no Price
export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { email, full_name, role, password } = await req.json()
  if (!email || !full_name || !role || !password) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const priceAdmin = createSupabaseClient(PRICE_SUPABASE_URL, PRICE_SERVICE_ROLE)

  // Cria usuário no Supabase do Price
  const { data: newUser, error } = await priceAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Cria perfil com role
  await priceAdmin.from('price_profiles').upsert({
    id: newUser.user.id,
    full_name,
    role,
    email,
  })

  return NextResponse.json({ ok: true, user: { id: newUser.user.id, email, full_name, role } })
}

// Atualiza role do usuário
export async function PATCH(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, role } = await req.json()
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const priceAdmin = createSupabaseClient(PRICE_SUPABASE_URL, PRICE_SERVICE_ROLE)
  await priceAdmin.from('price_profiles').update({ role }).eq('id', id)

  return NextResponse.json({ ok: true })
}

// Remove usuário do Price
export async function DELETE(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
  const priceAdmin = createSupabaseClient(PRICE_SUPABASE_URL, PRICE_SERVICE_ROLE)
  await priceAdmin.auth.admin.deleteUser(id)

  return NextResponse.json({ ok: true })
}
