'use client'

export function PipelineTypeSelect({
  defaultValue,
  action,
}: {
  defaultValue: string
  action: (formData: FormData) => void
}) {
  return (
    <form action={action} className="mt-1.5 flex items-center gap-1.5">
      <label className="text-[11px] text-gray-500">Tipo:</label>
      <select
        name="type"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] focus:border-brand-700 focus:outline-none"
      >
        <option value="gestao_contratos">Gestão de Contratos</option>
        <option value="vendas">Vendas</option>
      </select>
    </form>
  )
}
