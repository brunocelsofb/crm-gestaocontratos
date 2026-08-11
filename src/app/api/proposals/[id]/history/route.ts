import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const contractId = searchParams.get('contract_id')
  if (!contractId) return NextResponse.json({ logs: [] })

  const admin = createAdminClient()

  // Busca TODOS os logs de aprovação desta proposta + logs de sistema com proposal_id
  const { data: logs, error } = await admin
    .from('activities')
    .select('id, type, content, created_at, metadata')
    .eq('contract_id', contractId)
    .in('type', ['proposal', 'system', 'client_decision'])
    .order('created_at', { ascending: true })

  if (error) console.error('[history]', error)

  // Filtra: inclui se metadata.proposal_id === id OU se não tem proposal_id (logs legados)
  const filtered = (logs ?? []).filter(log => {
    const pid = log.metadata?.proposal_id
    // Se tem proposal_id de OUTRA proposta, exclui
    if (pid && pid !== id) return false
    // Sem proposal_id = log legado do contrato, inclui se conteúdo é relevante
    const c = (log.content ?? '').toLowerCase()
    if (log.type === 'client_decision') return true
    return c.includes('proposta') || c.includes('análise') || c.includes('analise') ||
      c.includes('aprovad') || c.includes('reprovad') || c.includes('reaberta') ||
      c.includes('declinad') || c.includes('comercial') || c.includes('técnic') || c.includes('tecnic')
  })

  const enriched = filtered.map(log => ({
    ...log,
    actor_name: extractActor(log.content),
  }))

  return NextResponse.json({ logs: enriched })
}

function extractActor(content: string | null): string {
  if (!content) return '—'
  const match = content.match(/(?:por|aprovado por|reaberta por|enviada por)[:\s]+([^.·\n(]+)/i)
  return match?.[1]?.trim() ?? '—'
}
