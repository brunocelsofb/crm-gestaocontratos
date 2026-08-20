'use client'

import { useState } from 'react'
import type { RoutingCondition } from '@/lib/utils/lead-routing'

type Pipeline = { id: string; name: string }
type Stage = { id: string; name: string; pipeline_id: string }
type User = { id: string; full_name: string; role: string }
type Rule = {
  id: string; name: string; priority: number; is_active: boolean
  conditions: RoutingCondition[]; conditions_logic: 'AND' | 'OR'
  target_pipeline_id: string | null; target_stage_id: string | null
  responsible_type: 'none' | 'fixed' | 'round_robin'
  responsible_user_id: string | null
}

const FIELD_OPTIONS = [
  { value: 'source',         label: 'Origem' },
  { value: 'score',          label: 'Score do lead' },
  { value: 'sector',         label: 'Setor da empresa' },
  { value: 'has_phone',      label: 'Tem telefone' },
  { value: 'has_company',    label: 'Tem empresa' },
  { value: 'message_length', label: 'Tamanho da mensagem' },
]

const SOURCE_OPTIONS = [
  'formulario_site', 'indicacao', 'evento', 'ligacao', 'manual', 'anuncio'
]

function ConditionRow({ cond, onChange, onRemove }: {
  cond: RoutingCondition
  onChange: (c: RoutingCondition) => void
  onRemove: () => void
}) {
  const isBool = cond.field === 'has_phone' || cond.field === 'has_company'
  const isSource = cond.field === 'source'
  const isSector = cond.field === 'sector'
  const isNumeric = cond.field === 'score' || cond.field === 'message_length'

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <select value={cond.field} onChange={e => onChange({ ...cond, field: e.target.value as any, operator: 'equals', value: '' })}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]">
        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      {!isBool && (
        <select value={cond.operator} onChange={e => onChange({ ...cond, operator: e.target.value as any })}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]">
          {isNumeric
            ? <><option value="gte">≥ (maior ou igual)</option><option value="lte">≤ (menor ou igual)</option></>
            : <><option value="equals">é igual a</option><option value="not_equals">não é</option></>
          }
        </select>
      )}

      {isBool && (
        <select value={cond.operator} onChange={e => onChange({ ...cond, operator: e.target.value as any })}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]">
          <option value="is_true">está preenchido</option>
          <option value="not_equals">não está preenchido</option>
        </select>
      )}

      {isSource && (
        <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]">
          <option value="">Selecione...</option>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {isSector && (
        <select value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]">
          <option value="health">Setor de saúde</option>
          <option value="other">Outro setor</option>
        </select>
      )}

      {isNumeric && (
        <input type="number" value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
          placeholder="valor" className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:border-[#1B556B]" />
      )}

      <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
    </div>
  )
}

function RuleCard({ rule, pipelines, stages, users, onUpdate, onDelete }: {
  rule: Rule; pipelines: Pipeline[]; stages: Stage[]; users: User[]
  onUpdate: (r: Rule) => void; onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState({ ...rule })
  const [saving, setSaving] = useState(false)

  const filteredStages = stages.filter(s => s.pipeline_id === editing.target_pipeline_id)
  const pipelineName = pipelines.find(p => p.id === rule.target_pipeline_id)?.name ?? '—'
  const stageName = stages.find(s => s.id === rule.target_stage_id)?.name ?? '—'

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/settings/lead-routing', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const data = await res.json()
    setSaving(false)
    if (!data.error) { onUpdate(editing); setExpanded(false) }
  }

  async function handleToggle() {
    const updated = { ...rule, is_active: !rule.is_active }
    await fetch('/api/settings/lead-routing', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: updated.is_active }),
    })
    onUpdate(updated)
  }

  function addCondition() {
    setEditing(prev => ({ ...prev, conditions: [...prev.conditions, { field: 'source', operator: 'equals', value: '' }] }))
  }

  return (
    <div className={`rounded-xl border bg-white transition-opacity ${!rule.is_active ? 'opacity-50' : ''}`}>
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-gray-300 font-mono text-xs w-6 text-right">{rule.priority}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1B556B]">{rule.name}</p>
          <p className="text-xs text-gray-400">{rule.conditions.length} condição(ões) · {pipelineName} → {stageName}</p>
        </div>
        <label onClick={e => e.stopPropagation()} className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={rule.is_active} onChange={handleToggle} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-200 peer-checked:bg-[#1B556B] rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da regra</label>
              <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Prioridade (menor = primeiro)</label>
              <input type="number" value={editing.priority} onChange={e => setEditing(p => ({ ...p, priority: Number(e.target.value) }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Condições</label>
              <select value={editing.conditions_logic} onChange={e => setEditing(p => ({ ...p, conditions_logic: e.target.value as any }))}
                className="rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none">
                <option value="AND">Todas (AND)</option>
                <option value="OR">Qualquer (OR)</option>
              </select>
            </div>
            <div className="space-y-2">
              {editing.conditions.map((c, i) => (
                <ConditionRow key={i} cond={c}
                  onChange={updated => setEditing(p => ({ ...p, conditions: p.conditions.map((x, j) => j === i ? updated : x) }))}
                  onRemove={() => setEditing(p => ({ ...p, conditions: p.conditions.filter((_, j) => j !== i) }))} />
              ))}
            </div>
            <button onClick={addCondition} className="mt-2 text-xs text-[#1B556B] hover:underline">+ Adicionar condição</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Funil de destino</label>
              <select value={editing.target_pipeline_id ?? ''} onChange={e => setEditing(p => ({ ...p, target_pipeline_id: e.target.value || null, target_stage_id: null }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none">
                <option value="">Selecione...</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Etapa de entrada</label>
              <select value={editing.target_stage_id ?? ''} onChange={e => setEditing(p => ({ ...p, target_stage_id: e.target.value || null }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none" disabled={!editing.target_pipeline_id}>
                <option value="">Selecione...</option>
                {filteredStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Responsável</label>
              <select value={editing.responsible_type} onChange={e => setEditing(p => ({ ...p, responsible_type: e.target.value as any }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none">
                <option value="none">Sem responsável fixo</option>
                <option value="fixed">Responsável fixo</option>
                <option value="round_robin">Rodízio (Round-Robin)</option>
              </select>
            </div>
            {editing.responsible_type === 'fixed' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Usuário</label>
                <select value={editing.responsible_user_id ?? ''} onChange={e => setEditing(p => ({ ...p, responsible_user_id: e.target.value || null }))}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B556B] focus:outline-none">
                  <option value="">Selecione...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar regra'}
            </button>
            <button onClick={() => onDelete()}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function LeadRoutingEditor({ initialRules, pipelines, stages, users }: {
  initialRules: Rule[]; pipelines: Pipeline[]; stages: Stage[]; users: User[]
}) {
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    const res = await fetch('/api/settings/lead-routing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nova regra', priority: rules.length, conditions: [], conditions_logic: 'AND', is_active: false, responsible_type: 'none' }),
    })
    const data = await res.json()
    if (!data.error && data.rule) { setRules(prev => [...prev, data.rule]); setCreating(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta regra de roteamento?')) return
    await fetch('/api/settings/lead-routing', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setRules(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{rules.length} regra(s) configurada(s) · Processadas em ordem de prioridade</p>
        <button onClick={handleCreate} disabled={creating}
          className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
          + Nova regra
        </button>
      </div>
      {rules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhuma regra configurada. Clique em "+ Nova regra" para começar.</p>
        </div>
      )}
      {rules.map(rule => (
        <RuleCard key={rule.id} rule={rule} pipelines={pipelines} stages={stages} users={users}
          onUpdate={updated => setRules(prev => prev.map(r => r.id === updated.id ? updated : r))}
          onDelete={() => handleDelete(rule.id)} />
      ))}
    </div>
  )
}
