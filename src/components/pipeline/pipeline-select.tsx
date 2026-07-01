'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function PipelineSelect({
  pipelines,
  selected,
}: {
  pipelines: { id: string; name: string }[]
  selected?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pipeline', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
    >
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
