import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function daysAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / 86_400_000)
}

// "Inativo" aqui significa: sem nenhuma passagem de funil ABERTA agora
// (não estamos negociando nada com eles neste momento), seja contrato
// ou serviço avulso — olha todos os tipos de funil, não só um.
export default async function InactiveCompaniesPage() {
  const supabase = await createClient()

  const [{ data: companies }, { data: contracts }] = await Promise.all([
    supabase.from('companies').select('id, name, trade_name, cnpj'),
    supabase.from('contracts').select('id, company_id'),
  ])

  const contractIds = (contracts ?? []).map((c) => c.id)
  const { data: runs } = contractIds.length
    ? await supabase.from('pipeline_runs').select('contract_id, status, ended_at').in('contract_id', contractIds)
    : { data: [] as { contract_id: string; status: string; ended_at: string | null }[] }

  const companyIdByContract = new Map((contracts ?? []).map((c) => [c.id, c.company_id]))

  // Agrega por EMPRESA (uma empresa pode ter vários contratos ao longo
  // do tempo) — junta tudo pra saber: tem algo aberto agora? qual foi o
  // último negócio fechado (Ganho), de qualquer funil?
  const hasOpenByCompany = new Map<string, boolean>()
  const lastWonByCompany = new Map<string, string>()

  for (const run of runs ?? []) {
    const companyId = companyIdByContract.get(run.contract_id)
    if (!companyId) continue

    if (run.status === 'open') {
      hasOpenByCompany.set(companyId, true)
    }

    if (run.status === 'won' && run.ended_at) {
      const current = lastWonByCompany.get(companyId)
      if (!current || run.ended_at > current) {
        lastWonByCompany.set(companyId, run.ended_at)
      }
    }
  }

  const inactiveCompanies = (companies ?? [])
    .filter((c) => !hasOpenByCompany.get(c.id))
    .map((c) => ({
      ...c,
      lastWon: lastWonByCompany.get(c.id) ?? null,
    }))
    .sort((a, b) => {
      // Nunca fechamos negócio = prioridade máxima (topo da lista);
      // entre os que já fecharam, quem está há mais tempo sem novo
      // negócio vem primeiro.
      if (!a.lastWon && !b.lastWon) return 0
      if (!a.lastWon) return -1
      if (!b.lastWon) return 1
      return a.lastWon.localeCompare(b.lastWon)
    })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Clientes Inativos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Empresas sem nenhuma negociação em aberto agora (contrato ou serviço avulso) — pra saber quem procurar de novo.
          </p>
        </div>
        <Link href="/companies" className="text-sm text-gray-500 hover:text-brand-700">
          ← Todas as empresas
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Empresa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">CNPJ</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Último negócio fechado</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Há quanto tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inactiveCompanies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/companies/${c.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.name}
                  </Link>
                  {c.trade_name && <div className="text-xs text-gray-400">{c.trade_name}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.cnpj ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">
                  {c.lastWon ? new Date(c.lastWon).toLocaleDateString('pt-BR') : (
                    <span className="text-yellow-700">Nunca fechamos negócio</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {c.lastWon ? `${daysAgo(c.lastWon)} dias` : '—'}
                </td>
              </tr>
            ))}
            {inactiveCompanies.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma empresa inativa — todas têm alguma negociação em aberto agora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
