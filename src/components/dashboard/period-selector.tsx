import Link from 'next/link'

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4) {
  const startMonth = (quarter - 1) * 3
  const from = new Date(year, startMonth, 1)
  const to = new Date(year, startMonth + 3, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function PeriodSelector({
  from,
  to,
  basePath = '/nps-dashboard',
  extraParams = {},
}: {
  from: string
  to: string
  basePath?: string
  extraParams?: Record<string, string | undefined>
}) {
  const year = new Date().getFullYear()
  const presets = [
    { label: 'Q1', ...quarterRange(year, 1) },
    { label: 'Q2', ...quarterRange(year, 2) },
    { label: 'Q3', ...quarterRange(year, 3) },
    { label: 'Q4', ...quarterRange(year, 4) },
    { label: 'Ano todo', from: `${year}-01-01`, to: `${year}-12-31` },
  ]

  function buildHref(f: string, t: string) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v)
    }
    params.set('from', f)
    params.set('to', t)
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-1">
        {presets.map((p) => {
          const active = p.from === from && p.to === to
          return (
            <Link
              key={p.label}
              href={buildHref(p.from, p.to)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                active ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </Link>
          )
        })}
      </div>

      <form method="GET" action={basePath} className="flex items-end gap-2">
        {Object.entries(extraParams).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null
        )}
        <div>
          <label className="block text-[10px] text-gray-500">De</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500">Até</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Aplicar
        </button>
      </form>
    </div>
  )
}
