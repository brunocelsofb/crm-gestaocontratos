import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/pipeline', label: 'Funil (Kanban)' },
  { href: '/contracts', label: 'Contratos' },
]

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
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4">
        <h2 className="mb-6 px-2 text-sm font-semibold text-gray-900">
          Contract CRM
        </h2>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
