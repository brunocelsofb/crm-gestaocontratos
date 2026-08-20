'use client'

import { useState, useTransition } from 'react'

type Rule = {
  id: string
  criterion_key: string
  label: string
  points: number
  is_active: boolean
  description?: string | null
}

const DEFAULT_RULES = [
  { criterion_key: 'corporate_email',   label: 'E-mail corporativo',              points: 25, description: 'E-mail não é gmail, hotmail, etc.' },
  { criterion_key: 'health_sector_fit', label: 'Empresa do setor de saúde',       points: 25, description: 'Nome da empresa contém keywords de saúde' },
  { criterion_key: 'source_indicacao',  label: 'Origem: Indicação',               points: 30, description: 'Lead veio por indicação de cliente ou parceiro' },
  { criterion_key: 'source_evento',     label: 'Origem: Evento',                  points: 20, description: 'Lead captado em evento ou feira' },
  { criterion_key: 'source_formulario', label: 'Origem: Formulário do site',      points: 15, description: 'Lead veio do formulário público' },
  { criterion_key: 'source_ligacao',    label: 'Origem: Ligação',                 points: 15, description: 'Lead captado por ligação ativa' },
  { criterion_key: 'phone_provided',    label: 'Telefone informado',              points: 10, description: 'Lead deixou telefone para contato' },
  { criterion_key: 'message_detailed',  label: 'Mensagem detalhada',              points: 10, description: 'Mensagem com mais de 20 caracteres' },
  { criterion_key: 'source_manual',     label: 'Origem: Manual',                  points: 10, description: 'Lead cadastrado manualmente' },
  { criterion_key: 'source_anuncio',    label: 'Origem: Anúncio',                 points:  5, description: 'Lead veio de anúncio pago' },
  { criterion_key: 'source_outro',      label: 'Origem: Outro',                   points:  5, description: 'Origem não mapeada' },
  { criterion_key: 'personal_email',    label: 'E-mail pessoal',                  points:  5, description: 'E-mail é gmail, hotmail, etc.' },
  { criterion_key: 'other_sector',      label: 'Empresa fora do setor de saúde',  points:  5, description: 'Empresa informada mas fora do perfil típico' },
]

async function saveRule(rule: Partial<Rule> & { id?: string }) {
  const res = await fetch('/api/settings/lead-scoring', {
    method: rule.id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  })
  return res.json()
}

async function deleteRule(id: string) {
  await fetch('/api/settings/lead-scoring', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

function RuleRow({ rule, onUpdate, onDelete }: {
  rule: Rule
  onUpdate: (r: Rule) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(rule.label)
  const [points, setPoints] = useState(String(rule.points))
  const [description, setDescription] = useState(rule.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await saveRule({ id: rule.id, label, points: Number(points), description })
    setSaving(false)
    if (!res.error) { onUpdate({ ...rule, label, points: Number(points), description }); setEditing(false) }
  }

  async function handleToggle() {
    const res = await saveRule({ id: rule.id, is_active: !rule.is_active })
    if (!res.error) onUpdate({ ...rule, is_active: !rule.is_active })
  }

  const pointsNum = Number(points || rule.points)
  const color = pointsNum >= 20 ? 'text-green-700 bg-green-50' : pointsNum >= 10 ? 'text-amber-700 bg-amber-50' : 'text-gray-600 bg-gray-50'

  if (editing) return (
    <tr className="bg-blue-50/30">
      <td className="px-4 py-3" colSpan={2}>
        <input value={label} onChange={e => setLabel(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1B556B] focus:outline-none" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição (opcional)"
          className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 focus:outline-none" />
      </td>
      <td className="px-4 py-3">
        <input type="number" value={points} onChange={e => setPoints(e.target.value)} min={-100} max={100}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-[#1B556B] focus:outline-none" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="rounded-md bg-[#1B556B] px-3 py-1 text-xs font-medium text-white hover:bg-[#164659] disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={() => setEditing(false)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )

  return (
    <tr className={!rule.is_active ? 'opacity-40' : ''}>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{rule.label}</p>
        {rule.description && <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>}
        <p className="text-[10px] font-mono text-gray-300 mt-0.5">{rule.criterion_key}</p>
      </td>
      <td className="px-4 py-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={rule.is_active} onChange={handleToggle} className="sr-only peer" />
          <div className="w-9 h-5 bg-gray-200 peer-checked:bg-[#1B556B] rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${color}`}>
          {rule.points > 0 ? '+' : ''}{rule.points}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Editar
          </button>
          <button onClick={onDelete}
            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
            Remover
          </button>
        </div>
      </td>
    </tr>
  )
}

export function LeadScoringEditor({ initialRules }: { initialRules: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newPoints, setNewPoints] = useState('10')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function handleRestore() {
    if (!confirm('Restaurar padrões de mercado? As regras existentes serão mantidas — apenas regras faltantes serão adicionadas.')) return
    setRestoring(true)
    const existingKeys = new Set(rules.map(r => r.criterion_key))
    const missing = DEFAULT_RULES.filter(r => !existingKeys.has(r.criterion_key))
    for (const rule of missing) {
      const res = await saveRule({ ...rule, is_active: true })
      if (!res.error && res.rule) setRules(prev => [...prev, res.rule].sort((a, b) => b.points - a.points))
    }
    setRestoring(false)
  }

  async function handleAdd() {
    if (!newKey.trim() || !newLabel.trim()) return
    setSaving(true)
    const res = await saveRule({ criterion_key: newKey.trim().toLowerCase().replace(/\s+/g, '_'), label: newLabel, points: Number(newPoints), description: newDesc, is_active: true })
    setSaving(false)
    if (!res.error && res.rule) {
      setRules(prev => [res.rule, ...prev])
      setAdding(false); setNewKey(''); setNewLabel(''); setNewPoints('10'); setNewDesc('')
    }
  }

  function handleUpdate(id: string, updated: Rule) {
    setRules(prev => prev.map(r => r.id === id ? updated : r))
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta regra? O critério não será mais aplicado ao calcular scores.')) return
    startTransition(async () => {
      await deleteRule(id)
      setRules(prev => prev.filter(r => r.id !== id))
    })
  }

  const totalMax = rules.filter(r => r.is_active && r.points > 0).reduce((s, r) => s + r.points, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Soma máxima possível: <strong>{totalMax} pts</strong>
          {totalMax > 100 && <span className="ml-2 text-amber-600 text-xs">(score é limitado a 100)</span>}
        </p>
        <div className="flex gap-2">
          <button onClick={handleRestore} disabled={restoring}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {restoring ? 'Restaurando...' : '↺ Restaurar padrões'}
          </button>
          <button onClick={() => setAdding(true)}
            className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659]">
            + Nova regra
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Critério</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ativo</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pontos</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adding && (
              <tr className="bg-blue-50/30">
                <td className="px-4 py-3" colSpan={2}>
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Chave única (ex: linkedin_informed)"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1B556B] focus:outline-none mb-1" />
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (ex: LinkedIn informado)"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-[#1B556B] focus:outline-none mb-1" />
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descrição (opcional)"
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 focus:outline-none" />
                </td>
                <td className="px-4 py-3">
                  <input type="number" value={newPoints} onChange={e => setNewPoints(e.target.value)} min={-100} max={100}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={saving}
                      className="rounded-md bg-[#1B556B] px-3 py-1 text-xs font-medium text-white hover:bg-[#164659] disabled:opacity-50">
                      {saving ? 'Salvando...' : 'Adicionar'}
                    </button>
                    <button onClick={() => setAdding(false)}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {rules.map(rule => (
              <RuleRow key={rule.id} rule={rule}
                onUpdate={updated => handleUpdate(rule.id, updated)}
                onDelete={() => handleDelete(rule.id)} />
            ))}
            {rules.length === 0 && !adding && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma regra cadastrada. Rode a migration e clique em "+ Nova regra".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
