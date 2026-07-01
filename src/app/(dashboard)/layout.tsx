import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNav } from '@/components/layout/sidebar-nav'

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

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 shrink-0 bg-brand-800 p-4">
        <div className="mb-8 flex items-center gap-2 px-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-positive-600 text-xs font-medium text-brand-900">
            C
          </div>
          <span className="text-sm font-medium text-white">Contract CRM</span>
        </div>
        <SidebarNav />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
