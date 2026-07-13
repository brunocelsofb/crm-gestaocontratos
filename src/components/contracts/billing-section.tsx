'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setBillingType, confirmBilling } from '@/lib/actions/billing'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

type BillingRecord = {
  id: string
  year: number
  month: number
  amount: number
  file_storage_path: string | null
  file_name: string | null
  notes: string | null
  confirmed_at: string
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function BillingSection({
  contractId,
  billingType,
  records,
}: {
  contractId: string
  billingType: string
  records: BillingRecord[]
}) {
  const now = new Date()
  const [type, setType] = useState(billingType)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleTypeChange(newType: string) {
    setType(newType)
    await setBillingType(contractId, newType as 'fixed' | 'metered')
  }

  async function handleConfirm() {
    if (!amount || Number.isNaN(Number(amount))) {
      setError('Informe o valor faturado.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      let filePath: string | null = null
      let fileNameToSave: string | null = null
      if (file) {
        const supabase = createClient()
        const storagePath = `billing/${contractId}/${year}-${month}-${Date.now()}-${sanitizeStorageFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from('contract-files').upload(storagePath, file)
        if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`)
        filePath = storagePath
        fileNameToSave = file.name
      }

      const formData = new FormData()
      formData.set('year', String(year))
      formData.set('month', String(month))
      formData.set('amount', amount)
      formData.set('notes', notes)

      // confirmBilling faz UPSERT por (contrato, ano, mês) — reenviar pro
      // mesmo mês/ano de um registro que já existe SOBRESCREVE ele, é
      // assim que a edição funciona (sem precisar de uma action separada).
      const result = await confirmBilling(contractId, filePath, fileNameToSave, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setAmount('')
        setNotes('')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao confirmar faturamento.')
    } finally {
      setBusy(false)
    }
  }

  function handleEdit(r: BillingRecord) {
    setYear(r.year)
    setMonth(r.month)
    setAmount(String(r.amount))
    setNotes(r.notes ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Faturamento</h2>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs focus:border-brand-700 focus:outline-none"
        >
          <option value="fixed">Contrato com valor fixo</option>
          <option value="metered">Contrato sob medição</option>
        </select>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
        <p className="text-xs font-medium text-gray-700">
          {records.some((r) => r.year === year && r.month === month) ? 'Editando faturamento do mês (já existe um registro pra esse mês)' : 'Confirmar faturamento do mês'}
        </p>
        {type === 'metered' && (
          <p className="mt-0.5 text-xs text-gray-400">Contrato sob medição — anexe o relatório com o valor apurado quando tiver.</p>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] text-gray-500">Mês</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500">Ano</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500">Valor faturado (R$)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="block text-[10px] text-gray-500">Nota (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-[10px] text-gray-500">Relatório de medição (opcional)</label>
          <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 text-xs" />
        </div>
        <button
          onClick={handleConfirm}
          disabled={busy}
          className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {busy ? 'Confirmando...' : 'Confirmar faturamento'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>

      <div className="space-y-1.5">
        {records.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            <div>
              <span className="font-medium text-gray-900">{MONTH_NAMES[r.month - 1]}/{r.year}</span>
              <span className="ml-2 text-gray-600">{fmt(r.amount)}</span>
              {r.file_name && <span className="ml-2 text-xs text-brand-700">📎 {r.file_name}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{new Date(r.confirmed_at).toLocaleDateString('pt-BR')}</span>
              <button onClick={() => handleEdit(r)} className="text-xs text-brand-700 hover:underline">
                Editar
              </button>
            </div>
          </div>
        ))}
        {records.length === 0 && <p className="text-sm text-gray-400">Nenhum faturamento confirmado ainda.</p>}
      </div>
    </div>
  )
}
