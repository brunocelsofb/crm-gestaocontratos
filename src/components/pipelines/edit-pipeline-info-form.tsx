'use client'

export function EditPipelineInfoForm({
  name,
  description,
  type,
  wonLabel,
  lostLabel,
  wonTargetPipelineId,
  allPipelines,
  action,
}: {
  name: string
  description: string | null
  type: string
  wonLabel: string
  lostLabel: string
  wonTargetPipelineId: string | null
  allPipelines: { id: string; name: string }[]
  action: (formData: FormData) => void
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-[10px] text-gray-500">Nome do funil</label>
        <input
          name="name"
          defaultValue={name}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm font-medium focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500">Descrição</label>
        <input
          name="description"
          defaultValue={description ?? ''}
          className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500">Tipo</label>
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
        >
          <option value="gestao_contratos">Gestão de Contratos</option>
          <option value="vendas">Vendas</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-positive-700">Botão de sucesso</label>
        <input
          name="won_label"
          defaultValue={wonLabel}
          placeholder="Ex: Renovado"
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] text-negative-700">Botão de perda</label>
        <input
          name="lost_label"
          defaultValue={lostLabel}
          placeholder="Ex: Não renovado"
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500">Ao dar sucesso, mover pra</label>
        <select
          name="won_target_pipeline_id"
          defaultValue={wonTargetPipelineId ?? ''}
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
        >
          <option value="">Nenhum (fica aqui mesmo)</option>
          {allPipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800"
      >
        Salvar
      </button>
    </form>
  )
}
