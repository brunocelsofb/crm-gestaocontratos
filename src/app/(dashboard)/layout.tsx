import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { signOut } from '@/lib/actions/auth'
import { LogOut } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Camada extra de proteção além do middleware — redundante de
  // propósito, pois middleware + layout juntos cobrem casos de
  // cache/edge diferentes. Não é desperdício, é defesa em profundidade.
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('name')
    .eq('id', 'default')
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const orgName = orgSettings?.name ?? 'Contract CRM'

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col bg-brand-800 p-4">
        <div className="mb-8 flex items-center gap-2 px-1">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-positive-600 text-xs font-medium text-brand-900">
            C
          </div>
          <span className="truncate text-sm font-medium text-white">{orgName}</span>
        </div>
        <div className="flex-1">
          <SidebarNav isAdmin={isAdmin} />
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="truncate px-2.5 text-xs text-brand-100/70">{profile?.full_name ?? user.email}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-brand-100/70 hover:bg-white/5 hover:text-white"
            >
              <LogOut size={16} strokeWidth={1.75} />
              Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
