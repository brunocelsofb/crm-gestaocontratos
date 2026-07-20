'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createContract, type ActionState } from '@/lib/actions/contracts'
import { createClient } from '@/lib/supabase/client'
import { CompanyContactSection } from '@/components/contracts/company-contact-section'
import { ValidityPeriodInput } from '@/components/contracts/validity-period-input'
import type { PipelineFieldConfig } from '@/lib/pipeline-field-config'

type Stage = { id: string; name: string }
type Pipeline = { id: string; name: string; is_default: boolean; type: string }

const initialState: ActionState = {}

const SOURCE_OPTIONS = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'licitacao', label: 'Licitação' },
  { value: 'prospeccao', label: 'Prospecção ativa' },
  { value: 'inbound', label: 'Inbound / Site' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'outro', label: 'Outro' },
]

export default function NewContractPage() {
  const [state, formAction, pending] = useActionState(createContract, initialState)
  const searchParams = useSearchParams()
  const pipelineParam = searchParams.get('pipeline')
  const companyIdParam = searchParams.get('company_id')

  const [pipelineId, setPipelineId] = useState<string | null>(pipelineParam)
  const [pipelineName, setPipelineName] = useState<string>('')
  const [pipelineType, setPipelineType] = useState<string>('gestao_contratos')
  const [stages, setStages] = useState<Stage[]>([])
  const [fieldConfigs, setFieldConfigs] = useState<PipelineFieldConfig[]>([])
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [orgCnpj, setOrgCnpj] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      let resolvedPipelineId = pipelineParam

      if (!resolvedPipelineId) {
        const { data: pipelines } = await supabase
          .from('pipelines')
          .select('id, name, is_default, type')
          .order('name')
        const defaultPipeline = (pipelines as Pipeline[] | null)?.find((p) => p.is_default) ?? pipelines?.[0]
        resolvedPipelineId = defaultPipeline?.id ?? null
        if (defaultPipeline) {
          setPipelineName(defaultPipeline.name)
          setPipelineType(defaultPipeline.type)
        }
      } else {
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('name, type')
          .eq('id', resolvedPipelineId)
          .single()
        if (pipeline) {
          setPipelineName(pipeline.name)
          setPipelineType(pipeline.type)
        }
      }

      setPipelineId(resolvedPipelineId)

      if (resolvedPipelineId) {
        const [{ data: stagesData }, { data: configsData }, { data: tagsData }, { data: orgData }] = await Promise.all([
          supabase.from('stages').select('id, name').eq('pipeline_id', resolvedPipelineId).order('order_index'),
          supabase.from('pipeline_field_configs').select('*').eq('pipeline_id', resolvedPipelineId).order('display_order'),
          supabase.from('tags').select('id, name, color').order('name'),
          supabase.from('organization_settings').select('company_cnpj').eq('id', 'default').maybeSingle(),
        ])
        setStages(stagesData ?? [])
        setFieldConfigs((configsData ?? []) as PipelineFieldConfig[])
        setTags(tagsData ?? [])
        setOrgCnpj(orgData?.company_cnpj ?? '')
      }
    }

    load()
  }, [pipelineParam])

  // Helper: verifica visibilidade do campo
  function fieldVis(key: string): 'required' | 'optional' | 'hidden' {
    if (fieldConfigs.length === 0) return key === 'title' ? 'required' : 'optional'
    return (fieldConfigs.find(c => c.field_key === key)?.visibility ?? 'optional') as 'required' | 'optional' | 'hidden'
  }
  function show(key: string) { return fieldVis(key) !== 'hidden' }
  function req(key: string) { return fieldVis(key) === 'required' }

  const inputCls = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none'

  return (
    <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href={companyIdParam ? `/companies/${companyIdParam}` : '/pipeline'}
        style={{ fontSize: 12, color: '#8892a4', textDecoration: 'none' }}>
        ← Voltar
      </Link>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
          {pipelineType === 'vendas' ? 'Nova Oportunidade' : 'Novo Contrato'}
        </h1>
        {pipelineName && <p style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>Funil: {pipelineName}</p>}
        {fieldConfigs.length > 0 && (
          <p style={{ fontSize: 11, color: '#b0b8c8', marginTop: 2 }}>
            Campos com <span style={{ color: '#b91c1c' }}>*</span> são obrigatórios para este funil.
          </p>
        )}
      </div>

      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 24 }}>
        <div>
          <label className="block text-sm font-medium text-gray-700">Número do Processo <span style={{ color: '#b91c1c' }}>*</span></label>
          <input name="process_number" required className={inputCls} />
          {state.fieldErrors?.process_number && <p style={{ marginTop: 4, fontSize: 11, color: '#b91c1c' }}>{state.fieldErrors.process_number[0]}</p>}
        </div>

        {show('title') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Título {req('title') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <input name="title" required={req('title')} className={inputCls} />
          </div>
        )}

        <CompanyContactSection preselectedCompanyId={companyIdParam ?? undefined} />

        {/* CNPJ da ORBIS */}
        {show('cnpj_orbis') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">CNPJ da ORBIS (contratada) {req('cnpj_orbis') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <input name="cnpj_orbis" defaultValue={orgCnpj} required={req('cnpj_orbis')} placeholder="00.000.000/0000-00" className={inputCls} />
            {orgCnpj && <p style={{ fontSize: 10, color: '#8892a4', marginTop: 3 }}>Preenchido automaticamente com o CNPJ da organização</p>}
          </div>
        )}

        {/* Tag */}
        {show('tag') && tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Tag / Etiqueta {req('tag') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <select name="tag_id" required={req('tag')} className={inputCls}>
              <option value="">Sem tag</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Valor */}
        {show('value') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Valor estimado (R$) {req('value') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <input name="value" type="number" step="0.01" min="0" defaultValue={0} required={req('value')} className={inputCls} />
          </div>
        )}

        {/* Tipo de receita MRR vs Spot */}
        {show('revenue_type') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de Receita {req('revenue_type') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <select name="revenue_type" required={req('revenue_type')} className={inputCls}>
              <option value="">Selecione...</option>
              <option value="mrr">MRR — Recorrente mensal</option>
              <option value="spot">Spot — Avulso / único</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Etapa inicial <span style={{ color: '#b91c1c' }}>*</span></label>
          <select name="stage_id" required className={inputCls}>
            <option value="">Selecione...</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {pipelineId && stages.length === 0 && <p style={{ marginTop: 4, fontSize: 11, color: '#92400e' }}>Nenhuma etapa cadastrada neste funil.</p>}
        </div>

        {show('source') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Origem da negociação {req('source') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <select name="source" required={req('source')} className={inputCls}>
              <option value="">Selecione...</option>
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {show('expected_close_date') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Previsão de fechamento {req('expected_close_date') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <input name="expected_close_date" type="date" required={req('expected_close_date')} className={inputCls} />
          </div>
        )}

        {show('description') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Descrição {req('description') && <span style={{ color: '#b91c1c' }}>*</span>}</label>
            <textarea name="description" rows={3} required={req('description')} className={inputCls} />
          </div>
        )}

        <input type="hidden" name="pipeline_id" value={pipelineId ?? ''} />

        {state.error && <p style={{ fontSize: 12, color: '#b91c1c' }}>{state.error}</p>}

        <button type="submit" disabled={pending}
          style={{ padding: '10px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', background: '#1a1f36', color: '#fff', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Salvando...' : pipelineType === 'vendas' ? 'Criar Oportunidade' : 'Criar Contrato'}
        </button>
      </form>
    </div>
  )
}