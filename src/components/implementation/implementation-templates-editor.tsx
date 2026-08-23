'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Task = { id: string; title: string; reference_doc: string | null; start_week: number; end_week: number; sort_order: number }
type Template = { id: string; name: string; trigger_tags: string[]; description: string | null; implementation_template_tasks: Task[] }

export function ImplementationTemplatesEditor({ initialTemplates }: { initialTemplates: Template[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [selected, setSelected] = useState<Template | null>(null)
  const [busy, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function saveTemplate(t: Partial<Template> & { tasks: Partial<Task>[] }) {
    setSaving(true); setMsg(null)
    const res = await fetch('/api/settings/implementation-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t)
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setMsg(data.error); return }
    setMsg('Salvo com sucesso!')
    router.refresh()
    setSelected(null)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Excluir este template? As implantações já criadas não serão afetadas.')) return
    await fetch(`/api/settings/implementation-templates?id=${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
    setSelected(null)
  }

  if (selected) return (
    <TemplateForm
      template={selected}
      busy={busy}
      msg={msg}
      onSave={saveTemplate}
      onCancel={() => { setSelected(null); setMsg(null) }}
    />
  )

  return (
    <div className="space-y-4">
      <button onClick={() => setSelected({ id: '', name: '', trigger_tags: [], description: null, implementation_template_tasks: [] })}
        className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#164659]">
        + Novo Modelo
      </button>
      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {t.trigger_tags.map(tag => (
                    <span key={tag} className="rounded-full bg-[#1B556B]/10 px-2 py-0.5 text-[10px] font-medium text-[#1B556B]">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{t.implementation_template_tasks.length} fases</span>
                <button onClick={() => setSelected(t)} className="text-xs text-[#1B556B] hover:underline">Editar</button>
                <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplateForm({ template, busy, msg, onSave, onCancel }: {
  template: Template; busy: boolean; msg: string | null
  onSave: (t: any) => void; onCancel: () => void
}) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [tags, setTags] = useState(template.trigger_tags.join(', '))
  const [tasks, setTasks] = useState<Partial<Task>[]>(
    template.implementation_template_tasks.length > 0
      ? [...template.implementation_template_tasks].sort((a, b) => a.sort_order - b.sort_order)
      : [{ title: '', reference_doc: '', start_week: 1, end_week: 1, sort_order: 1 }]
  )

  function addTask() {
    setTasks(prev => [...prev, { title: '', reference_doc: '', start_week: 1, end_week: 1, sort_order: prev.length + 1 }])
  }
  function updateTask(i: number, field: string, value: any) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }
  function removeTask(i: number) {
    setTasks(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-[#1B556B]">{template.id ? 'Editar Modelo' : 'Novo Modelo'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Modelo</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tags de gatilho (separadas por vírgula)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="ECL, Engenharia Clínica"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B556B] focus:outline-none" />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Fases ({tasks.length})</h3>
          <button onClick={addTask} className="rounded-lg border border-[#1B556B] px-3 py-1 text-xs font-semibold text-[#1B556B] hover:bg-[#1B556B]/5">
            + Adicionar fase
          </button>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {tasks.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
              <span className="col-span-1 text-[10px] text-gray-400 text-center">{i + 1}</span>
              <input value={t.title ?? ''} onChange={e => updateTask(i, 'title', e.target.value)}
                placeholder="Título da fase" className="col-span-5 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none" />
              <input value={t.reference_doc ?? ''} onChange={e => updateTask(i, 'reference_doc', e.target.value)}
                placeholder="Doc referência" className="col-span-3 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none" />
              <input type="number" min={1} max={52} value={t.start_week ?? 1} onChange={e => updateTask(i, 'start_week', Number(e.target.value))}
                className="col-span-1 rounded border border-gray-300 px-1 py-1 text-xs text-center focus:outline-none" title="Semana início" />
              <input type="number" min={1} max={52} value={t.end_week ?? 1} onChange={e => updateTask(i, 'end_week', Number(e.target.value))}
                className="col-span-1 rounded border border-gray-300 px-1 py-1 text-xs text-center focus:outline-none" title="Semana fim" />
              <button onClick={() => removeTask(i)} className="col-span-1 text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">Colunas: # | Título | Doc Referência | Sem. Início | Sem. Fim | ✕</p>
      </div>

      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.includes('sucesso') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</p>}

      <div className="flex gap-3">
        <button disabled={busy} onClick={() => onSave({ id: template.id, name, description, trigger_tags: tags.split(',').map(s => s.trim()).filter(Boolean), tasks })}
          className="rounded-lg bg-[#1B556B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#164659] disabled:opacity-50">
          {busy ? 'Salvando...' : 'Salvar Modelo'}
        </button>
        <button onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  )
}
