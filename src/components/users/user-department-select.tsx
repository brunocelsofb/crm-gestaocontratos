'use client'

import { DEPARTMENTS } from '@/lib/constants/departments'

export function UserDepartmentSelect({
  defaultValue,
  action,
}: {
  defaultValue: string | null
  action: (formData: FormData) => void
}) {
  return (
    <form action={action}>
      <select
        name="department"
        defaultValue={defaultValue ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
      >
        <option value="">Sem departamento</option>
        {DEPARTMENTS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
    </form>
  )
}
