import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_qualificacao: 'Em Qualificação',
  qualificado: 'Qualificado',
  descartado: 'Descartado',
  convertido: 'Convertido',
}
const STATUS_ORDER = ['novo', 'em_qualificacao', 'qualificado', 'convertido', 'descartado']
const STATUS_STYLES: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700',
  em_qualificacao: 'bg-yellow-100 text-yellow-800',
  qualificado: 'bg-positive-100 text-positive-700',
  convertido: 'bg-brand-100 text-brand-700',
  descartado: 'bg-gray-100 text-gray-500',
}

function scoreColor(score: number) {
  if (score >= 60) return 'text-positive-700'
  if (score >= 30) return 'text-yellow-700'
  return 'text-gray-400'
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: statusFilter } = await searchParams
  const supabase = await createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, email, phone, company_name, status, score, source, created_at')
    .order('score', { ascending: false })

  const filtered = statusFilter ? (leads ?? []).filter((l) => l.status === statusFilter) : leads ?? []

  const countByStatus: Record<string, number> = {}
  for (const l of leads ?? []) {
    countByStatus[l.status] = (countByStatus[l.status] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Leads & Captação</h1>
          <p className="mt-0.5 text-sm text-gray-500">Antes de virar oportunidade — qualifique e converta quando fizer sentido.</p>
        </div>
        <div className="flex gap-2">
          <a href="/captura" target="_blank" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            🔗 Ver formulário público
          </a>
          <Link href="/leads/new" className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800">
            + Novo Lead
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/leads"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${!statusFilter ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          Todos ({leads?.length ?? 0})
        </Link>
        {STATUS_ORDER.map((s) => (
          <Link
            key={s}
            href={`/leads?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${statusFilter === s ? 'bg-brand-700 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {STATUS_LABELS[s]} ({countByStatus[s] ?? 0})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Origem</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Pontuação</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Recebido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-brand-700 hover:underline">
                    {lead.name}
                  </Link>
                  <div className="text-xs text-gray-400">{lead.email ?? lead.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{lead.company_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{lead.source ?? 'manual'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[lead.status]}`}>
                    {STATUS_LABELS[lead.status]}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${scoreColor(lead.score)}`}>{lead.score}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum lead nessa categoria ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
