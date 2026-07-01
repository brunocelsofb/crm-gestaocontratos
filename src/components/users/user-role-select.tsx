'use client'

export function UserRoleSelect({
  defaultValue,
  action,
}: {
  defaultValue: string
  action: (formData: FormData) => void
}) {
  return (
    <form action={action}>
      <select
        name="role"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-brand-700 focus:outline-none"
      >
        <option value="member">Membro</option>
        <option value="admin">Admin</option>
      </select>
    </form>
  )
}
