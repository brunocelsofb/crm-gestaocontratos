'use client'

import { useState } from 'react'
import { createAutomationRule, toggleAutomationRule, deleteAutomationRule } from '@/lib/actions/automations'

type Pipeline = { id: string; name: string; type: string; won_label: string; lost_label: string }
type Stage = { id: string; name: string; pipeline_id: string }
type Template = { id: string; name: string; context?: string }
type UserOption = { id: string; full_name: string }
type Tag = { id: string; name: string; color: string }
type Rule = {
  id: string
  name: string
  trigger_type: string
  trigger_stage_id: string | null
  trigger_pipeline_id: string | null
  trigger_tag_id: string | null
  days_threshold: number | null
  action_type: string
  target_stage_id: string | null
  task_content: string | null
  email_template_id: string | null
  notify_user_id: string | null
  notify_message: string | null
  is_active: boolean
}

const ACTION_LABELS: Record<string, string> = {
  move_to_stage: 'Mover pra outra etapa',
  move_to_pipeline: 'Mover pra outro funil',
  create_task: 'Criar tarefa',
  send_email: 'Enviar e-mail (template)',
  notify_user: 'Notificar alguém',
}

const TRIGGER_LABELS: Record<string, string> = {
  stage_entry: 'Entrar numa etapa',
  days_without_progress: 'Ficar parado X dias numa etapa',
  outcome_won: 'Marcar sucesso (Ganho ou Renovado)',
  outcome_lost: 'Marcar perda (Perdido ou Não renovado)',
  tag_added: 'Incluir uma tag',
  tag_removed: 'Retirar uma tag',
  days_before_expiration: 'Faltar X dias pro vencimento',
  ticket_linked: 'Ticket de atendimento vinculado a uma conta',
}

export function AutomationsManager({
  initialRules,
  pipelines,
  stages,
  templates,
  users,
  tags,
}: {
  initialRules: Rule[]
  pipelines: Pipeline[]
  stages: Stage[]
  templates: Template[]
  users: UserOption[]
  tags: Tag[]
}) {
  const [triggerType, setTriggerType] = useState('stage_entry')
  const [actionType, setActionType] = useState('move_to_stage')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOutcomeTrigger = triggerType === 'outcome_won' || triggerType === 'outcome_lost'
  const isTagTrigger = triggerType === 'tag_added' || triggerType === 'tag_removed'
  const isExpirationTrigger = triggerType === 'days_before_expiration'
  const isTicketTrigger = triggerType === 'ticket_linked'
  const relevantTemplates = isTicketTrigger ? templates.filter((t) => t.context === 'ticket') : templates.filter((t) => t.context !== 'ticket')

  function stageLabel(stageId: string | null) {
    if (!stageId) return '—'
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return '—'
    const pipeline = pipelines.find((p) => p.id === stage.pipeline_id)
    return `${pipeline?.name ?? '?'} → ${stage.name}`
  }

  function triggerDescription(r: Rule) {
    if (r.trigger_type === 'outcome_won' || r.trigger_type === 'outcome_lost') {
      const pipeline = pipelines.find((p) => p.id === r.trigger_pipeline_id)
      const label = r.trigger_type === 'outcome_won' ? pipeline?.won_label ?? 'Ganho' : pipeline?.lost_label ?? 'Perdido'
      return `marcar "${label}" em ${pipeline?.name ?? '?'}`
    }
    if (r.trigger_type === 'tag_added' || r.trigger_type === 'tag_removed') {
      const tag = tags.find((t) => t.id === r.trigger_tag_id)
      return `${r.trigger_type === 'tag_added' ? 'incluir' : 'retirar'} a tag "${tag?.name ?? '?'}"`
    }
    if (r.trigger_type === 'days_before_expiration') {
      const pipeline = pipelines.find((p) => p.id === r.trigger_pipeline_id)
      return `faltar ${r.days_threshold} dias pro vencimento${pipeline ? ` (${pipeline.name})` : ''}`
    }
    if (r.trigger_type === 'ticket_linked') return 'um ticket ser vinculado a uma conta'
    if (r.trigger_type === 'days_without_progress') return `parado ${r.days_threshold} dias em ${stageLabel(r.trigger_stage_id)}`
    return `entrar em ${stageLabel(r.trigger_stage_id)}`
  }

  async function handleSubmit(formData: FormData) {
    setBusy(true)
    setError(null)
    const result = await createAutomationRule(formData)
    setBusy(false)
    if (result.error) setError(result.error)
    else window.location.reload()
  }

  async function handleToggle(ruleId: string, current: boolean) {
    await toggleAutomationRule(ruleId, !current)
    window.location.reload()
  }

  async function handleDelete(ruleId: string) {
    if (!confirm('Remover essa automação?')) return
    await deleteAutomationRule(ruleId)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      <form action={handleSubmit} className="space-y-4 rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Nova automação</p>

        <div>
          <label className="block text-xs text-gray-500">Nome</label>
          <input name="name" required placeholder="Ex: Avisar renovação 60 dias antes" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>

        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-400">Quando</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Gatilho</label>
              <select name="trigger_type" value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            {isOutcomeTrigger && (
              <div>
                <label className="block text-xs text-gray-500">Funil</label>
                <select name="trigger_pipeline_id" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="">Selecione...</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({triggerType === 'outcome_won' ? p.won_label : p.lost_label})</option>
                  ))}
                </select>
              </div>
            )}

            {isTagTrigger && (
              <div>
                <label className="block text-xs text-gray-500">Qual tag</label>
                <select name="trigger_tag_id" required className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="">Selecione...</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {isExpirationTrigger && (
              <>
                <div>
                  <label className="block text-xs text-gray-500">Quantos dias antes</label>
                  <input name="days_threshold" type="number" min="1" placeholder="Ex: 60" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Funil (opcional — filtra só esse)</label>
                  <select name="trigger_pipeline_id" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                    <option value="">Qualquer funil</option>
                    {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {!isOutcomeTrigger && !isTagTrigger && !isExpirationTrigger && !isTicketTrigger && (
              <div>
                <label className="block text-xs text-gray-500">Etapa</label>
                <select name="trigger_stage_id" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="">Selecione...</option>
                  {pipelines.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {stages.filter((s) => s.pipeline_id === p.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {triggerType === 'days_without_progress' && (
              <div>
                <label className="block text-xs text-gray-500">Quantos dias parado</label>
                <input name="days_threshold" type="number" min="1" placeholder="Ex: 5" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
              </div>
            )}
          </div>
          {isTicketTrigger && (
            <p className="mt-2 text-xs text-gray-400">Dispara toda vez que um ticket de atendimento é vinculado a uma conta (na criação ou depois) — a ação disponível aqui é só &quot;Enviar e-mail&quot;, direto pro solicitante do ticket.</p>
          )}
        </div>

        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-400">Então</p>
          <div className="mt-2 space-y-2">
            <div>
              <label className="block text-xs text-gray-500">Ação</label>
              <select name="action_type" value={actionType} onChange={(e) => setActionType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                {Object.entries(ACTION_LABELS)
                  .filter(([value]) => !isTicketTrigger || value === 'send_email')
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            {(actionType === 'move_to_stage' || actionType === 'move_to_pipeline') && (
              <div>
                <label className="block text-xs text-gray-500">Etapa de destino</label>
                <select name="target_stage_id" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="">Selecione...</option>
                  {pipelines.map((p) => (
                    <optgroup key={p.id} label={p.name}>
                      {stages.filter((s) => s.pipeline_id === p.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {actionType === 'create_task' && (
              <div>
                <label className="block text-xs text-gray-500">Texto da tarefa</label>
                <input name="task_content" placeholder="Ex: Ligar pra confirmar interesse" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
              </div>
            )}

            {actionType === 'send_email' && (
              <div>
                <label className="block text-xs text-gray-500">Template de e-mail {isTicketTrigger ? '(de atendimento)' : '(de contrato)'}</label>
                <select name="email_template_id" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                  <option value="">Selecione...</option>
                  {relevantTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {relevantTemplates.length === 0 && <p className="mt-1 text-xs text-yellow-700">Nenhum template desse tipo criado ainda — crie em Templates de E-mail primeiro.</p>}
              </div>
            )}

            {actionType === 'notify_user' && (
              <>
                <div>
                  <label className="block text-xs text-gray-500">Quem notificar</label>
                  <select name="notify_user_id" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
                    <option value="">Selecione...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Mensagem (opcional)</label>
                  <input name="notify_message" placeholder="Se vazio, usa uma mensagem padrão" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
                </div>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">
          {busy ? 'Salvando...' : 'Criar automação'}
        </button>
      </form>

      <div className="space-y-1.5">
        {initialRules.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{r.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(r.id, r.is_active)} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_active ? 'bg-positive-100 text-positive-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.is_active ? 'Ativa' : 'Pausada'}
                </button>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-negative-600 hover:underline">Remover</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Quando: {triggerDescription(r)}
              {' → '}Então: {ACTION_LABELS[r.action_type]}
              {r.action_type === 'move_to_stage' && ` (${stageLabel(r.target_stage_id)})`}
              {r.action_type === 'create_task' && r.task_content && ` ("${r.task_content}")`}
            </p>
          </div>
        ))}
        {initialRules.length === 0 && <p className="text-sm text-gray-400">Nenhuma automação criada ainda.</p>}
      </div>
    </div>
  )
}
