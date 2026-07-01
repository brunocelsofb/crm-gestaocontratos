import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { updateUserRole } from '@/lib/actions/users'
import { UserRoleSelect } from '@/components/users/user-role-select'

export default async function UsersPage() {
  const currentProfile = await getCurrentProfile()

  // Trava dupla: além do RLS (que impede o UPDATE de qualquer forma se
  // não for admin), nem deixamos a tela carregar para quem não é admin.
  if (currentProfile?.role !== 'admin') {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Usuários</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Apenas administradores podem excluir registros (funis, etapas, contatos, empresas). Membros podem criar e editar normalmente.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">E-mail</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Papel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {profiles?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{p.email}</td>
                <td className="px-4 py-3">
                  {p.id === currentProfile.id ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                      Admin (você)
                    </span>
                  ) : (
                    <UserRoleSelect defaultValue={p.role} action={updateUserRole.bind(null, p.id)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
