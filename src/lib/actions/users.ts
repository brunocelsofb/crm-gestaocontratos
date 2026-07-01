'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile } from '@/lib/auth/role'

export type ActionState = { error?: string }

export async function createUserByAdmin(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentProfile = await getCurrentProfile()
  if (currentProfile?.role !== 'admin') {
    return { error: 'Só administradores podem criar usuários.' }
  }

  const email = (formData.get('email') as string)?.trim()
  const fullName = (formData.get('full_name') as string)?.trim()
  const password = formData.get('password') as string
  const role = (formData.get('role') as string) === 'admin' ? 'admin' : 'member'

  if (!email || !fullName || !password) {
    return { error: 'Preencha nome, e-mail e senha.' }
  }
  if (password.length < 6) {
    return { error: 'A senha precisa ter pelo menos 6 caracteres.' }
  }

  const adminClient = createAdminClient()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created?.user) {
    return { error: `Falha ao criar usuário: ${createError?.message ?? 'erro desconhecido'}` }
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role,
  })

  if (profileError) {
    return {
      error: `O login foi criado, mas o perfil falhou (${profileError.message}). Contate o suporte técnico — o usuário existe mas não vai conseguir usar o sistema direito ainda.`,
    }
  }

  revalidatePath('/users')
  return {}
}

export async function updateUserRole(targetUserId: string, formData: FormData) {
  const currentProfile = await getCurrentProfile()
  if (currentProfile?.role !== 'admin') return

  // Proteção extra: não deixa o admin remover o próprio acesso de admin
  // por engano, ficando sem ninguém com permissão para reverter.
  if (targetUserId === currentProfile.id) return

  const newRole = (formData.get('role') as string) === 'admin' ? 'admin' : 'member'

  const supabase = await createClient()
  await supabase.from('profiles').update({ role: newRole }).eq('id', targetUserId)

  revalidatePath('/users')
}
