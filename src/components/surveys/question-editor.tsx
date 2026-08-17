'use client'

import type { Question } from '@/lib/actions/custom-surveys'

const TYPE_OPTIONS = [
  { value: 'nps',     label: 'NPS (Nota 0-10)',       hint: 'Detratores, Neutros e Promotores' },
  { value: 'likert',  label: 'Likert (1-5)',           hint: 'Muito Insatisfeito → Muito Satisfeito' },
  { value: 'yesno',   label: 'Sim / Não',              hint: 'Resposta binária' },
  { value: 'text',    label: 'Texto livre',            hint: 'Campo aberto para o respondente' },
  { value: 'textarea', label: 'Comentário longo',      hint: 'Texto em múltiplas linhas' },
]

const TYPE_PREVIEW: Record<string, React.ReactNode> = {
  nps: (
    <div className="flex gap-1 flex-wrap">
      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
        <span key={n} className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium border ${
          n <= 6 ? 'bg-red-50 border-red-200 text-red-700' :
          n <= 8 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
          'bg-green-50 border-green-200 text-green-700'
        }`}>{n}</span>
      ))}
      <div className="w-full flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
        <span>Detrator</span><span>Neutro</span><span>Promotor</span>
      </div>
    </div>
  ),
  likert: (
    <div className="flex gap-2 flex-wrap">
      {['Muito Insatisfeito','Insatisfeito','Neutro','Satisfeito','Muito Satisfeito'].map((l, i) => (
        <span key={i} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
          {i+1} – {l}
        </span>
      ))}
    </div>
  ),
  yesno: (
    <div className="flex gap-2">
      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-0.5 text-xs text-green-700 font-medium">✓ Sim</span>
      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-0.5 text-xs text-red-700 font-medium">✗ Não</span>
    </div>
  ),
  text: <div className="h-8 rounded border border-gray-200 bg-gray-50 px-2 flex items-center text-xs text-gray-400">Resposta do participante...</div>,
  textarea: <div className="h-14 rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-400">Comentário livre...</div>,
}

export function QuestionEditor({
  question, index, total, onChange, onRemove, onMoveUp, onMoveDown
}: {
  question: Question
  index: number
  total: number
  onChange: (q: Question) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const typeInfo = TYPE_OPTIONS.find(t => t.value === question.type)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Header da pergunta */}
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1B556B]/10 flex items-center justify-center text-xs font-bold text-[#1B556B]">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <input
            value={question.label}
            onChange={e => onChange({ ...question, label: e.target.value })}
            placeholder="Texto da pergunta..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:ring-2 focus:ring-[#1B556B]/20 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} title="Mover para cima"
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 text-sm">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} title="Mover para baixo"
            className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-30 text-sm">↓</button>
          <button onClick={onRemove} title="Remover pergunta"
            className="w-7 h-7 flex items-center justify-center rounded border border-red-200 text-red-500 hover:bg-red-50 text-sm">×</button>
        </div>
      </div>

      {/* Tipo de resposta */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_OPTIONS.map(t => (
          <button key={t.value} onClick={() => onChange({ ...question, type: t.value as Question['type'] })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              question.type === t.value
                ? 'bg-[#1B556B] text-white border-[#1B556B]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#1B556B]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Preview do tipo */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
        <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">Preview — {typeInfo?.hint}</p>
        {TYPE_PREVIEW[question.type] ?? null}
      </div>

      {/* Obrigatório */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={question.required ?? true}
          onChange={e => onChange({ ...question, required: e.target.checked })}
          className="rounded border-gray-300 text-[#1B556B] focus:ring-[#1B556B]" />
        <span className="text-xs text-gray-600">Resposta obrigatória</span>
      </label>
    </div>
  )
}
