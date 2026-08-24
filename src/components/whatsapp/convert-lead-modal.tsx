'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ConvertLeadModal as OfficialConvertModal } from '@/components/leads/convert-lead-modal'

type Pipeline = { id: string; name: string }
type Stage    = { id: string; name: string; pipeline_id: string }
type User     = { id: string; full_name: string }

// Wrapper que carrega os dados necessários e reutiliza o modal oficial do CRM
export function ConvertLeadModal({
  phone, leadId, displayName, onClose,
}: {
  phone: string; leadId: string | null; displayName?: string | null; onClose: () => void
}) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(leadId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        // Cria lead se não existir
        let lid = leadId
        if (!lid) {
          const r = await fetch('/api/whatsapp/ensure-lead', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, name: displayName ?? phone }),
          })
          const d = await r.json()
          if (d.error) { setError(d.error); setLoading(false); return }
          lid = d.leadId
        }
        setResolvedLeadId(lid)

        // Busca pipelines, stages e usuários em paralelo
        const [pr, ur] = await Promise.all([
          fetch('/api/pipelines-list?withStages=true', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/team-users', { credentials: 'include' }).then(r => r.json()),
        ])

        const ps: any[] = pr.pipelines ?? []
        const allStages: Stage[] = ps.flatMap((p: any) =>
          (p.pipeline_stages ?? []).map((s: any) => ({ id: s.id, name: s.name, pipeline_id: p.id }))
        )
        setPipelines(ps.map((p: any) => ({ id: p.id, name: p.name })))
        setStages(allStages)
        setUsers(ur.users ?? [])
        setLoading(false)
      } catch (e: any) {
        setError(e.message)
        setLoading(false)
      }
    }
    init()
  }, [phone, leadId, displayName])

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-2 border-[#1B556B] border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-gray-500">Preparando oportunidade...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm space-y-4">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={onClose} className="w-full rounded-lg border px-4 py-2 text-sm">Fechar</button>
      </div>
    </div>
  )

  if (!resolvedLeadId || pipelines.length === 0) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm space-y-4">
        <p className="text-gray-600 text-sm">Nenhum funil configurado. Configure pipelines em Configurações.</p>
        <button onClick={onClose} className="w-full rounded-lg border px-4 py-2 text-sm">Fechar</button>
      </div>
    </div>
  )

  return (
    <OfficialConvertModal
      leadId={resolvedLeadId}
      leadName={displayName ?? phone}
      pipelines={pipelines}
      stages={stages}
      users={users}
      onClose={onClose}
    />
  )
}
