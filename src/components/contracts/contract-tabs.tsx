'use client'

import { useState, useEffect, type ReactNode, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ContractTabsInner({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const fromPrice = searchParams.get('from') === 'price'
    if (tabParam && tabs.find(t => t.id === tabParam)) {
      setActiveId(tabParam)
      if (fromPrice) router.refresh()
    }
  }, [searchParams])

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

export function ContractTabs({ tabs, tabOrder }: {
  tabs: { id: string; label: string; content: ReactNode }[]
  tabOrder?: string[] | null
}) {
  const ordered = tabOrder
    ? [...tabOrder.map(id => tabs.find(t => t.id === id)).filter(Boolean) as typeof tabs,
       ...tabs.filter(t => !tabOrder.includes(t.id))]
    : tabs

  return (
    <Suspense fallback={null}>
      <ContractTabsInner tabs={ordered} />
    </Suspense>
  )
}
