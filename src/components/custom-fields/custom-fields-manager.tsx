'use client'

import { useState } from 'react'
import { createCustomField, deleteCustomField } from '@/lib/actions/custom-fields'

type CustomField = { id: string; name: string; field_key: string; field_type: string; select_options: string[] | null }

export function CustomFieldsManager({ initialFields }: { initialFields: CustomField[] }) {
  const [fieldType, setFieldType] = useState('text')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setBusy(true)
    setError(null)
    const result = await createCustomField(formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else window.location.reload()
  }

  async function handleDelete(fieldId: string) {
    if (!confirm('Remover esse campo? Os valores já preenchidos em contratos também somem, e templates que usam essa variável ficam com o espaço em branco.')) return
    await deleteCustomField(fieldId)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Novo campo customizado</p>
        <div>
          <label className="block text-xs text-gray-500">Nome do campo</label>
          <input name="name" required placeholder="Ex: Data de Início, Tipo de Projeto, Unidade de Saúde" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Tipo</label>
          <select name="field_type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="select">Lista de opções</option>
          </select>
        </div>
        {fieldType === 'select' && (
          <div>
            <label className="block text-xs text-gray-500">Opções (separadas por vírgula)</label>
            <input name="select_options" placeholder="Ex: Recorrente, Pontual, Sob demanda" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Criando...' : 'Criar campo'}
        </button>
      </form>

      <div className="space-y-1.5">
        {initialFields.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div>
              <span className="font-medium text-gray-900">{f.name}</span>
              <code className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{'{{' + f.field_key + '}}'}</code>
              <span className="ml-2 text-xs text-gray-400">({f.field_type === 'text' ? 'Texto' : f.field_type === 'number' ? 'Número' : f.field_type === 'date' ? 'Data' : 'Lista'})</span>
            </div>
            <button onClick={() => handleDelete(f.id)} className="text-xs text-negative-600 hover:underline">Remover</button>
          </div>
        ))}
        {initialFields.length === 0 && <p className="text-sm text-gray-400">Nenhum campo customizado criado ainda.</p>}
      </div>
    </div>
  )
}
