'use client'

type Tag = { id: string; name: string; color: string }

export function ContractTagSelect({
  tags,
  currentTagId,
  action,
}: {
  tags: Tag[]
  currentTagId: string | null
  action: (formData: FormData) => void
}) {
  return (
    <form action={action} className="inline-block">
      <select
        name="tag_id"
        defaultValue={currentTagId ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-full border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-700"
        style={{
          backgroundColor: tags.find((t) => t.id === currentTagId)?.color ?? '#E5E7EB',
          color: currentTagId ? '#fff' : '#6B7280',
        }}
      >
        <option value="">Sem tag</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </form>
  )
}
