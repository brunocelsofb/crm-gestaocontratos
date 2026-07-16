'use client'

import { useRef, useEffect, useState } from 'react'
import { useActionState } from 'react'
import { createEmailTemplate, deleteEmailTemplate, type ActionState } from '@/lib/actions/email'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type Template = { id: string; name: string; subject: string | null; body: string; trigger_stage_id: string | null; context?: string; channel?: string }

const initialState: ActionState = {}

export function EmailTemplatesManager({
  initialTemplates,
  pipelines,
  stages,
  customFields,
}: {
  initialTemplates: Template[]
  pipelines: Pipeline[]
  stages: Stage[]
  customFields: { id: string; name: string; field_key: string }[]
}) {
  const [state, formAction, pending] = useActionState(createEmailTemplate, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [channel, setChannel] = useState('email')

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset()
  }, [pending, state])

  async function handleDelete(id: string) {
    if (!confirm('Remover este template?')) return
    await deleteEmailTemplate(id)
  }

  function stageLabel(stageId: string | null) {
    if (!stageId) return null
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return null
    const pipeline = pipelines.find((p) => p.id === stage.pipeline_id)
    return `${pipeline?.name ?? '?'} → ${stage.name}`
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Novo template</p>
        <div>
          <label className="block text-xs text-gray-500">Para qual módulo?</label>
          <select name="context" defaultValue="contract" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="contract">Contrato / Oportunidade</option>
            <option value="ticket">Atendimento (ticket)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Canal</label>
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="email">E-mail</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Nome do template</label>
          <input name="name" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        {channel === 'email' && (
          <div>
            <label className="block text-xs text-gray-500">Assunto</label>
            <input name="subject" required placeholder="Ex: Bem-vindo, {{cliente}}!" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500">
            {channel === 'whatsapp' ? 'Mensagem (texto simples, sem HTML)' : 'Corpo do e-mail (HTML simples)'} — variáveis de contrato: <code>{'{{cliente}}'}</code> <code>{'{{empresa}}'}</code> <code>{'{{contato}}'}</code> <code>{'{{processo}}'}</code> <code>{'{{valor}}'}</code> <code>{'{{cnpj}}'}</code> <code>{'{{responsavel}}'}</code> <code>{'{{data_hoje}}'}</code> <code>{'{{minha_empresa}}'}</code> <code>{'{{minha_cnpj}}'}</code>
            {' '}| variáveis de ticket: <code>{'{{ticket_numero}}'}</code> <code>{'{{ticket_assunto}}'}</code> <code>{'{{solicitante}}'}</code>
            {customFields.length > 0 && (
              <>
                {' '}| campos customizados: {customFields.map((f) => <code key={f.id} className="mr-1">{'{{' + f.field_key + '}}'}</code>)}
                {' '}(<a href="/custom-fields" className="text-brand-700 hover:underline">gerenciar</a>)
              </>
            )}
          </label>
          <textarea name="body" required rows={6} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono focus:border-brand-700 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Disparar automaticamente ao entrar nesta etapa (opcional)</label>
          <select name="trigger_stage_id" defaultValue="" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
            <option value="">Não disparar automaticamente (só manual)</option>
            {pipelines.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {stages.filter((s) => s.pipeline_id === p.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {pending ? 'Salvando...' : 'Criar template'}
        </button>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </form>

      <div className="space-y-1.5">
        {initialTemplates.map((t) => (
          <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">{t.name}</span>
                {t.subject && <span className="ml-2 text-xs text-gray-400">{t.subject}</span>}
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.context === 'ticket' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {t.context === 'ticket' ? 'Atendimento' : 'Contrato'}
                </span>
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                </span>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-xs text-negative-600 hover:underline">Remover</button>
            </div>
            {t.trigger_stage_id && stageLabel(t.trigger_stage_id) && (
              <p className="mt-1 text-xs text-brand-700">⚡ Dispara automaticamente em: {stageLabel(t.trigger_stage_id)}</p>
            )}
          </div>
        ))}
        {initialTemplates.length === 0 && <p className="text-sm text-gray-400">Nenhum template criado ainda.</p>}
      </div>
    </div>
  )
}
