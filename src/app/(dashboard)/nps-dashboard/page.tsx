import { createClient } from '@/lib/supabase/server'
import { PeriodSelector } from '@/components/nps/period-selector'
import { BulkSendNpsButton } from '@/components/nps/bulk-send-nps-button'
import { calculateNps, categorizeScore } from '@/lib/utils/nps'

const CATEGORY_LABELS = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' } as const
const CATEGORY_STYLES = {
  promoter: 'bg-positive-100 text-positive-700',
  passive: 'bg-yellow-100 text-yellow-800',
  detractor: 'bg-negative-100 text-negative-700',
} as const

function currentQuarterRange() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), quarter * 3, 1)
  const to = new Date(now.getFullYear(), quarter * 3 + 3, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default async function NpsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const defaultRange = currentQuarterRange()
  const from = params.from ?? defaultRange.from
  const to = params.to ?? defaultRange.to

  const supabase = await createClient()

  const { data: surveys } = await supabase
    .from('nps_surveys')
    .select('id, contract_id, score, comment, answered_at, respondent_name, respondent_email, respondent_phone')
    .eq('status', 'answered')
    .gte('answered_at', `${from}T00:00:00`)
    .lte('answered_at', `${to}T23:59:59`)
    .order('answered_at', { ascending: false })

  const contractIds = [...new Set((surveys ?? []).map((s) => s.contract_id))]

  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, client_name, company_id, contact_id').in('id', contractIds)
    : { data: [] as { id: string; client_name: string; company_id: string | null; contact_id: string | null }[] }

  const contractById = new Map((contracts ?? []).map((c) => [c.id, c]))
  const companyIds = [...new Set((contracts ?? []).map((c) => c.company_id).filter((v): v is string => !!v))]
  const contactIds = [...new Set((contracts ?? []).map((c) => c.contact_id).filter((v): v is string => !!v))]

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    companyIds.length
      ? supabase.from('companies').select('id, name, trade_name, cnpj').in('id', companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; trade_name: string | null; cnpj: string | null }[] }),
    contactIds.length
      ? supabase.from('contacts').select('id, name').in('id', contactIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const companyById = new Map((companies ?? []).map((c) => [c.id, c]))
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]))

  const scores = (surveys ?? []).map((s) => s.score).filter((s): s is number => s !== null)
  const { nps, promoters, passives, detractors, total } = calculateNps(scores)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard de NPS</h1>
          <p className="mt-0.5 text-sm text-gray-500">Consolidado do período selecionado.</p>
        </div>
        <BulkSendNpsButton />
      </div>

      <PeriodSelector from={from} to={to} />

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">NPS do período</p>
          <p className={`text-3xl font-semibold ${nps === null ? 'text-gray-300' : nps >= 50 ? 'text-positive-700' : nps >= 0 ? 'text-yellow-700' : 'text-negative-700'}`}>
            {nps === null ? '—' : nps}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Promotores</p>
          <p className="text-3xl font-semibold text-positive-700">{promoters}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Neutros</p>
          <p className="text-3xl font-semibold text-yellow-700">{passives}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Detratores</p>
          <p className="text-3xl font-semibold text-negative-700">{detractors}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400">{total} resposta{total === 1 ? '' : 's'} no período · NPS = % Promotores − % Detratores</p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">CNPJ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Respondido por</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Categoria</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Comentário</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {surveys?.map((s) => {
              const contract = contractById.get(s.contract_id)
              const company = contract?.company_id ? companyById.get(contract.company_id) : null
              const contact = contract?.contact_id ? contactById.get(contract.contact_id) : null
              const category = s.score !== null ? categorizeScore(s.score) : null

              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{company?.name ?? contract?.client_name ?? '—'}</div>
                    {company?.trade_name && <div className="text-xs text-gray-400">{company.trade_name}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{company?.cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{s.respondent_name ?? contact?.name ?? '—'}</div>
                    {(s.respondent_email || s.respondent_phone) && (
                      <div className="text-xs text-gray-400">
                        {[s.respondent_email, s.respondent_phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {category && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[category]}`}>
                        {CATEGORY_LABELS[category]} — {s.score}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-600">{s.comment ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              )
            })}

            {surveys?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma resposta de NPS neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
