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

  // Busca activities de mudança de status relacionadas a esta proposta
  const { data: logs } = await admin
    .from('activities')
    .select('id, type, content, created_at, metadata')
    .eq('contract_id', contractId)
    .in('type', ['stage_change', 'system', 'client_decision'])
    .or(`metadata->>proposal_id.eq.${id},metadata->>proposal_id.is.null`)
    .order('created_at', { ascending: true })

  // Filtra apenas logs relevantes para aprovação de proposta
  const APPROVAL_KEYWORDS = [
    'Análise Técnica', 'Aprovada Tecnic', 'Reprovada Tecnic', 'Reprovado Tecnic',
    'Aprovação Comercial', 'Aprovada Comercial', 'Reprovada Comercial',
    'cliente', 'reaberta', 'declinada', 'Proposta',
  ]

  const filtered = (logs ?? []).filter(log =>
    log.type === 'client_decision' ||
    APPROVAL_KEYWORDS.some(kw => log.content?.toLowerCase().includes(kw.toLowerCase()))
  )

  // Extrai actor_name do content para exibição
  const enriched = filtered.map(log => ({
    ...log,
    actor_name: extractActor(log.content),
  }))

  return NextResponse.json({ logs: enriched })
}

function extractActor(content: string | null): string {
  if (!content) return '—'
  // Extrai nome após "por " ou "Aprovado por:"
  const match = content.match(/(?:por|Aprovado por|reaberta por)[:\s]+([^.·\n]+)/i)
  return match?.[1]?.trim().split(' ·')[0] ?? '—'
}
