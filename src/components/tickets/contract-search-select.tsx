'use client'

import { useState, useEffect, useRef } from 'react'
import { searchContractsForTicket } from '@/lib/actions/tickets'

type ContractOption = { id: string; client_name: string; process_number: string }

export function ContractSearchSelect({
  name,
  onSelect,
  required,
  initialValue,
}: {
  name: string
  onSelect?: (contract: ContractOption | null) => void
  required?: boolean
  initialValue?: ContractOption
}) {
  const [query, setQuery] = useState(
    initialValue ? (initialValue.process_number ? `${initialValue.client_name} (${initialValue.process_number})` : initialValue.client_name) : ''
  )
  const [results, setResults] = useState<ContractOption[]>([])
  const [selected, setSelected] = useState<ContractOption | null>(initialValue ?? null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || selected) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const data = await searchContractsForTicket(query)
      setResults(data)
      setOpen(true)
    }, 300)
  }, [query, selected])

  function handlePick(contract: ContractOption) {
    setSelected(contract)
    setQuery(`${contract.client_name} (${contract.process_number})`)
    setOpen(false)
    onSelect?.(contract)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    onSelect?.(null)
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-600">
        Contrato do cliente {required && <span className="text-negative-600">*</span>}
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ''} required={required} />
      <div className="mt-1 flex items-center gap-1.5">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (selected) setSelected(null)
          }}
          placeholder="Busque por nome do cliente ou nº do processo..."
          className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
        {selected && (
          <button type="button" onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600">
            Trocar
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePick(c)}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
            >
              {c.client_name} <span className="text-xs text-gray-400">({c.process_number})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
