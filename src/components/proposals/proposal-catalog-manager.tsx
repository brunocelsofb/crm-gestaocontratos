'use client'

import { useRef, useEffect } from 'react'
import { useActionState } from 'react'
import { createCatalogItem, deleteCatalogItem, type ActionState } from '@/lib/actions/proposals'

type CatalogItem = { id: string; name: string; category: string | null; type: string | null; characteristics: string | null; unit_value: number }

const initialState: ActionState = {}

export function ProposalCatalogManager({ initialItems }: { initialItems: CatalogItem[] }) {
  const [state, formAction, pending] = useActionState(createCatalogItem, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state])

  async function handleDelete(id: string) {
    if (!confirm('Remover este item do catálogo?')) return
    await deleteCatalogItem(id)
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={formAction} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Novo item no catálogo</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500">Nome do item</label>
            <input name="name" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Categoria</label>
            <input name="category" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Tipo</label>
            <input name="type" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Valor unitário padrão (R$)</label>
            <input name="unit_value" type="number" step="0.01" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500">Características padrão (opcional)</label>
            <input name="characteristics" placeholder="Ex: escopo de manutenção e metrologia" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
        </div>
        <button type="submit" disabled={pending} className="mt-2 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {pending ? 'Salvando...' : 'Adicionar ao catálogo'}
        </button>
        {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Categoria</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Valor padrão</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {initialItems.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2 font-medium text-gray-900">{it.name}</td>
                <td className="px-3 py-2 text-gray-600">{it.category ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{it.type ?? '—'}</td>
                <td className="px-3 py-2 text-gray-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.unit_value)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => handleDelete(it.id)} className="text-xs text-gray-400 hover:text-negative-600">Remover</button>
                </td>
              </tr>
            ))}
            {initialItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nenhum item cadastrado ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
