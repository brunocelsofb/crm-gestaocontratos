'use client'

import { useState } from 'react'
import { QuestionEditor } from './question-editor'
import { saveSurveyTemplate, deleteSurveyTemplate, duplicateSurveyTemplate } from '@/lib/actions/custom-surveys'
import type { Question } from '@/lib/actions/custom-surveys'

type Template = {
  id: string; name: string; category: string; questions: Question[]
  target_type: 'any' | 'contracts' | 'avulso' | 'tag'
  target_tag_id?: string | null
  created_at: string
}
type Tag = { id: string; name: string }

const TARGET_OPTIONS = [
  { value: 'any',       label: 'Qualquer funil (sem restrição)' },
  { value: 'contracts', label: 'Apenas Funil de Contratos' },
  { value: 'avulso',    label: 'Apenas Funil de Serviços Avulsos' },
  { value: 'tag',       label: 'Por Tag específica' },
]

const TARGET_BADGE: Record<string, string> = {
  any:       'bg-gray-100 text-gray-600',
  contracts: 'bg-[#1B556B]/10 text-[#1B556B]',
  avulso:    'bg-orange-100 text-orange-700',
  tag:       'bg-purple-100 text-purple-700',
}

const CATEGORIES = [
  { value: 'eng_clinica', label: 'Engenharia Clínica' },
  { value: 'eng_hospitalar', label: 'Engenharia Hospitalar/Predial' },
  { value: 'avulso', label: 'Mini-Pesquisa Avulsa' },
  { value: 'geral', label: 'Geral' },
]

const CATEGORY_BADGE: Record<string, string> = {
  eng_clinica: 'bg-teal-100 text-teal-800',
  eng_hospitalar: 'bg-blue-100 text-blue-800',
  avulso: 'bg-orange-100 text-orange-800',
  geral: 'bg-gray-100 text-gray-700',
}

function newQuestion(): Question {
  return { id: crypto.randomUUID(), label: '', type: 'likert', required: true }
}

export function FormsEditor({ initialTemplates, availableTags = [] }: { initialTemplates: Template[], availableTags?: Tag[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('geral')
  const [editTargetType, setEditTargetType] = useState<string>('any')
  const [editTargetTagId, setEditTargetTagId] = useState<string>('')
  const [editQuestions, setEditQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startNew() {
    setEditingId('new'); setEditName(''); setEditCategory('geral')
    setEditTargetType('any'); setEditTargetTagId(''); setEditQuestions([newQuestion()]); setError(null)
  }

  function startEdit(t: Template) {
    setEditingId(t.id); setEditName(t.name); setEditCategory(t.category ?? 'geral')
    setEditTargetType(t.target_type ?? 'any'); setEditTargetTagId(t.target_tag_id ?? ''); setEditQuestions(t.questions ?? []); setError(null)
  }

  function cancelEdit() { setEditingId(null); setError(null) }

  function addQuestion() {
    setEditQuestions(prev => [...prev, newQuestion()])
  }

  function updateQuestion(idx: number, q: Question) {
    setEditQuestions(prev => prev.map((old, i) => i === idx ? q : old))
  }

  function removeQuestion(idx: number) {
    setEditQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    setEditQuestions(prev => {
      const arr = [...prev]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  async function handleSave() {
    if (!editName.trim()) { setError('Informe o nome do formulário.'); return }
    if (editQuestions.length === 0) { setError('Adicione pelo menos uma pergunta.'); return }
    const emptyQ = editQuestions.find(q => !q.label.trim())
    if (emptyQ) { setError('Preencha o texto de todas as perguntas.'); return }

    setSaving(true); setError(null)
    const res = await saveSurveyTemplate(
      editingId === 'new' ? null : editingId!,
      editName, editCategory, editQuestions,
      editTargetType, editTargetTagId || null
    )
    if (res.error) { setError(res.error); setSaving(false); return }
    setSaving(false)
    setEditingId(null)
    // Recarrega a lista via router refresh
    window.location.reload()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este formulário? Esta ação não pode ser desfeita.')) return
    await deleteSurveyTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function handleDuplicate(id: string) {
    await duplicateSurveyTemplate(id)
    window.location.reload()
  }

  if (editingId !== null) {
    return (
      <div className="space-y-6">
        {/* Header do editor */}
        <div className="flex items-center gap-3">
          <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
          <h2 className="text-base font-semibold text-[#1B556B]">
            {editingId === 'new' ? 'Novo formulário' : 'Editar formulário'}
          </h2>
        </div>

        {/* Nome e Categoria */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#1B556B] mb-1">Nome do formulário *</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Ex: Pesquisa de Satisfação - Engenharia Clínica"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1B556B] mb-1">Categoria</label>
            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#1B556B] mb-1">Vincular formulário a</label>
            <select value={editTargetType} onChange={e => setEditTargetType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
              {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {editTargetType === 'tag' && (
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Selecione a tag</label>
                <select value={editTargetTagId} onChange={e => setEditTargetTagId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none">
                  <option value="">Selecione uma tag...</option>
                  {availableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {editTargetType === 'any' && 'Aparecerá em contratos e oportunidades avulsas.'}
              {editTargetType === 'contracts' && 'Aparecerá apenas na aba Pesquisas dos Contratos.'}
              {editTargetType === 'avulso' && 'Aparecerá apenas em Oportunidades de Serviços Avulsos.'}
              {editTargetType === 'tag' && 'Aparecerá em contratos/oportunidades com esta tag.'}
            </p>
          </div>
        </div>

        {/* Perguntas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1B556B]">Perguntas ({editQuestions.length})</h3>
            <button onClick={addQuestion}
              className="rounded-lg bg-[#1B556B] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#164659]">
              + Adicionar pergunta
            </button>
          </div>

          {editQuestions.map((q, idx) => (
            <QuestionEditor
              key={q.id}
              question={q}
              index={idx}
              total={editQuestions.length}
              onChange={updated => updateQuestion(idx, updated)}
              onRemove={() => removeQuestion(idx)}
              onMoveUp={() => moveQuestion(idx, -1)}
              onMoveDown={() => moveQuestion(idx, 1)}
            />
          ))}

          {editQuestions.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">Nenhuma pergunta ainda. Clique em "+ Adicionar pergunta".</p>
            </div>
          )}
        </div>

        {/* Ações */}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-[#1B556B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar formulário'}
          </button>
          <button onClick={cancelEdit}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={startNew}
          className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659]">
          + Novo formulário
        </button>
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-base font-medium text-gray-400">Nenhum formulário criado ainda.</p>
          <p className="mt-1 text-sm text-gray-400">Clique em "+ Novo formulário" para começar.</p>
        </div>
      )}

      {templates.map(t => (
        <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#1B556B] text-sm">{t.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGE[t.category] ?? CATEGORY_BADGE.geral}`}>
                {CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TARGET_BADGE[t.target_type] ?? TARGET_BADGE.any}`}>
                {TARGET_OPTIONS.find(o => o.value === t.target_type)?.label ?? 'Qualquer funil'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {(t.questions ?? []).length} pergunta{(t.questions ?? []).length !== 1 ? 's' : ''} · criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(t.questions ?? []).slice(0, 3).map(q => (
                <span key={q.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  {q.type === 'nps' ? 'NPS (0-10)' : q.type === 'likert' ? 'Likert (1-5)' : q.type === 'yesno' ? 'Sim/Não' : q.type === 'text' ? 'Texto' : q.type}
                </span>
              ))}
              {(t.questions ?? []).length > 3 && <span className="text-xs text-gray-400">+{(t.questions ?? []).length - 3} mais</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => startEdit(t)}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Editar
            </button>
            <button onClick={() => handleDuplicate(t.id)}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Duplicar
            </button>
            <button onClick={() => handleDelete(t.id)}
              className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
              Excluir
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
