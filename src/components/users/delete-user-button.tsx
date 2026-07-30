'use client'

import { useTransition } from 'react'

export function DeleteUserButton({ action, name }: { action: () => Promise<void>; name: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => {
        if (!confirm(`Excluir ${name} permanentemente? Esta ação não pode ser desfeita.`)) return
        startTransition(() => action())
      }}
      disabled={isPending}
      className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
    >
      {isPending ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}

export function ToggleUserButton({ action, name, isBanned }: { action: () => Promise<void>; name: string; isBanned: boolean }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => {
        const msg = isBanned ? `Reativar ${name}?` : `Desativar ${name}? Ele não conseguirá mais fazer login.`
        if (!confirm(msg)) return
        startTransition(() => action())
      }}
      disabled={isPending}
      className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
    >
      {isPending ? '...' : isBanned ? 'Reativar' : 'Desativar'}
    </button>
  )
}
