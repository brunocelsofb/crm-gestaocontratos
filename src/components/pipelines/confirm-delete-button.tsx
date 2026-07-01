'use client'

export function ConfirmDeleteButton({
  label = 'Remover',
  confirmMessage,
  className,
}: {
  label?: string
  confirmMessage: string
  className?: string
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault()
      }}
      className={className ?? 'text-xs text-gray-400 hover:text-negative-600'}
    >
      {label}
    </button>
  )
}
