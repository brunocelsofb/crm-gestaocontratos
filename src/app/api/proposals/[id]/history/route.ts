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

  // Busca TODOS os logs de aprovação de proposta (type=proposal) e decisões do cliente
  const { data: logs } = await admin
    .from('activities')
    .select('id, type, content, created_at, metadata')
    .eq('contract_id', contractId)
    .in('type', ['proposal', 'system', 'client_decision'])
    .order('created_at', { ascending: true })

  // Filtra os relevantes para ESTA proposta (pelo proposal_id no metadata ou pelo content)
  const filtered = (logs ?? []).filter(log => {
    const pid = log.metadata?.proposal_id
    // Inclui se metadata tem este proposal_id, ou se não tem proposal_id (log geral do contrato)
    return !pid || pid === id
  }).filter(log => {
    // Exclui logs completamente sem relação com aprovações
    const c = log.content?.toLowerCase() ?? ''
    if (log.type === 'client_decision') return true
    return c.includes('análise técnica') || c.includes('analise tecnica') ||
      c.includes('aprovada') || c.includes('reprovada') || c.includes('reprovado') ||
      c.includes('comercial') || c.includes('cliente') || c.includes('reaberta') ||
      c.includes('declinada') || c.includes('proposta') || c.includes('enviada')
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
