'use client'

import { useState } from 'react'
import { addMonthsToDateString } from '@/lib/utils/date'

const MONTH_SHORTCUTS = [1, 2, 3, 6, 12]

export function ValidityPeriodInput({
  defaultFrom,
  defaultUntil,
  defaultAutoRenewal,
}: {
  defaultFrom?: string | null
  defaultUntil?: string | null
  defaultAutoRenewal?: boolean
}) {
  const [from, setFrom] = useState(defaultFrom ?? '')
  const [until, setUntil] = useState(defaultUntil ?? '')

  function applyMonths(months: number) {
    if (!from) return
    setUntil(addMonthsToDateString(from, months))
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Vigência — início</label>
          <input
            name="valid_from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Vigência — fim</label>
          <input
            name="valid_until"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {MONTH_SHORTCUTS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={!from}
                onClick={() => applyMonths(m)}
                title={!from ? 'Preencha o início da vigência primeiro' : `Calcular ${m} mês(es) a partir do início`}
                className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +{m} {m === 1 ? 'mês' : 'meses'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Os botões calculam a data certinho (considerando meses de 28 a 31 dias) — ou digite a data exata direto no campo.
          </p>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="auto_renewal" defaultChecked={defaultAutoRenewal} className="rounded border-gray-300" />
        Renovação automática (por cláusula contratual — normalmente só precisa atualizar a vigência, sem negociação)
      </label>
    </div>
  )
}
