'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, KanbanSquare, FileText, Building2, Settings2, Users, Settings, Smile, ClipboardList, Tag, BarChart3, Target, LifeBuoy, Mail, UserCircle } from 'lucide-react'

const BASE_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/minha-conta', label: 'Minha Conta', icon: UserCircle },
  { href: '/pipeline', label: 'Funil', icon: KanbanSquare },
  { href: '/leads', label: 'Leads', icon: Target },
  { href: '/tickets', label: 'Atendimento', icon: LifeBuoy },
  { href: '/contracts', label: 'Contratos', icon: FileText },
  { href: '/companies', label: 'Empresas', icon: Building2 },
  { href: '/surveys-dashboard', label: 'Pesquisas e NPS', icon: BarChart3 },
  { href: '/surveys', label: 'Formulários', icon: ClipboardList },
  { href: '/tags', label: 'Tags', icon: Tag },
  { href: '/proposals/templates', label: 'Modelos de Proposta', icon: FileText },
  { href: '/proposals/catalog', label: 'Catálogo de Produtos', icon: FileText },
  { href: '/email-templates', label: 'Templates de E-mail', icon: Mail },
  { href: '/pipelines', label: 'Funis e Etapas', icon: Settings2 },
]

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  const items = isAdmin
    ? [
        ...BASE_NAV_ITEMS,
        { href: '/users', label: 'Usuários', icon: Users },
        { href: '/settings', label: 'Configurações', icon: Settings },
      ]
    : BASE_NAV_ITEMS

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              active
                ? 'bg-white/10 text-white'
                : 'text-brand-100/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
