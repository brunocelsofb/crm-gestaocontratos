'use client'

import { useFormStatus } from 'react-dom'

export function SaveButton({
  children = 'Salvar',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? 'rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50'}
    >
      {pending ? 'Salvando...' : children}
    </button>
  )
}
