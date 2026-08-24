'use client'
export default function WhatsAppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <p className="text-red-600 font-medium">Erro: {error.message}</p>
      <button onClick={reset} className="rounded-lg bg-[#1B556B] px-4 py-2 text-sm text-white">Tentar novamente</button>
    </div>
  )
}
