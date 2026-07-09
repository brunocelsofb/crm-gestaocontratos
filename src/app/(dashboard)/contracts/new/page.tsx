'use client'

// NOTA DE INCERTEZA: estou usando o hook `useActionState` (de 'react'),
// confirmado compatível com React 19.2.4 nesta versão do projeto (testei
// o build). Se você trocar de versão do React no futuro e isso quebrar,
// o equivalente mais antigo é `useFormState` de 'react-dom'.

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createContract, type ActionState } from '@/lib/actions/contracts'
import { createClient } from '@/lib/supabase/client'
import { CompanyContactSection } from '@/components/contracts/company-contact-section'

type Stage = { id: string; name: string }
type Pipeline = { id: string; name: string; is_default: boolean }

const initialState: ActionState = {}

export default function NewContractPage() {
  const [state, formAction, pending] = useActionState(createContract, initialState)
  const searchParams = useSearchParams()
  const pipelineParam = searchParams.get('pipeline')
  const companyIdParam = searchParams.get('company_id')

  const [pipelineId, setPipelineId] = useState<string | null>(pipelineParam)
  const [pipelineName, setPipelineName] = useState<string>('')
  const [stages, setStages] = useState<Stage[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      let resolvedPipelineId = pipelineParam

      if (!resolvedPipelineId) {
        const { data: pipelines } = await supabase
          .from('pipelines')
          .select('id, name, is_default')
          .order('name')
        const defaultPipeline = (pipelines as Pipeline[] | null)?.find((p) => p.is_default) ?? pipelines?.[0]
        resolvedPipelineId = defaultPipeline?.id ?? null
        if (defaultPipeline) setPipelineName(defaultPipeline.name)
      } else {
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('name')
          .eq('id', resolvedPipelineId)
          .single()
        if (pipeline) setPipelineName(pipeline.name)
      }

      setPipelineId(resolvedPipelineId)

      if (resolvedPipelineId) {
        const { data } = await supabase
          .from('stages')
          .select('id, name')
          .eq('pipeline_id', resolvedPipelineId)
          .order('order_index')
        setStages(data ?? [])
      }
    }

    load()
  }, [pipelineParam])

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-[17px] font-medium text-foreground">Novo Contrato</h1>
        {pipelineName && (
          <p className="mt-0.5 text-xs text-foreground/50">Funil: {pipelineName}</p>
        )}
      </div>

      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Número do Processo <span className="text-red-500">*</span>
          </label>
          <input
            name="process_number"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          {state.fieldErrors?.process_number && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.process_number[0]}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input
            name="title"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>

        <CompanyContactSection preselectedCompanyId={companyIdParam ?? undefined} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Valor (R$)</label>
            <input
              name="value"
              type="number"
              step="0.01"
              min="0"
              defaultValue={0}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Etapa</label>
            <select
              name="stage_id"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {pipelineId && stages.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Nenhuma etapa encontrada para este funil.</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Data prevista de fechamento</label>
          <input
            name="expected_close_date"
            type="date"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Vigência — início</label>
            <input
              name="valid_from"
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vigência — fim</label>
            <input
              name="valid_until"
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Descrição</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar Contrato'}
        </button>
      </form>
    </div>
  )
}
