'use client'

import { useState, useEffect, type ReactNode } from 'react'

export function ContractTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)

  // Lê ?tab= da URL ao montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && tabs.find(t => t.id === tabParam)) {
      setActiveId(tabParam)
      // Remove o parâmetro da URL sem reload
      const url = new URL(window.location.href)
      url.searchParams.delete('tab')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              t.id === active?.id
                ? 'border-b-2 border-brand-700 text-brand-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{active?.content}</div>
    </div>
  )
}
