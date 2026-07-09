import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ValidityBadge } from '@/components/contracts/validity-badge'

// Server Component: busca os dados direto no servidor, sem useEffect
// nem loading state no client — reduz JS enviado ao navegador.

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  // NOTA DE INCERTEZA: o Supabase/PostgREST resolve "embedding" (o join
  // automático tipo `stages(name)`) baseado em foreign keys DECLARADAS
  // nas tabelas. Não tenho certeza se isso funciona de forma confiável
  // quando a origem é uma VIEW (contracts_with_current_run) em vez de
  // uma tabela real — pode não detectar a relação. Para não arriscar
  // quebrar em produção, faço em duas consultas simples e junto os
  // dados aqui no servidor, em vez de depender de embedding sobre a view.

  let query = supabase
    .from('contracts_with_current_run')
    .select('id, process_number, title, client_name, value, run_status, stage_id')
    .order('created_at', { ascending: false })

  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.or(
      `process_number.ilike.%${term}%,title.ilike.%${term}%,client_name.ilike.%${term}%`
    )
  }

  const { data: contracts, error } = await query

  const contractIds = (contracts ?? []).map((c) => c.id)
  const stageIds = [...new Set((contracts ?? []).map((c) => c.stage_id).filter(Boolean))]

  const [{ data: stages }, { data: validityData }] = await Promise.all([
    stageIds.length
      ? supabase.from('stages').select('id, name, color').in('id', stageIds)
      : Promise.resolve({ data: [] as { id: string; name: string; color: string | null }[] }),
    contractIds.length
      ? supabase.from('contracts').select('id, valid_until').in('id', contractIds)
      : Promise.resolve({ data: [] as { id: string; valid_until: string | null }[] }),
  ])

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))
  const validUntilById = new Map((validityData ?? []).map((c) => [c.id, c.valid_until]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Contratos</h1>
        <Link
          href="/contracts/new"
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Novo Contrato
        </Link>
      </div>

      {/* Busca via GET simples — funciona sem JavaScript no client,
          e o resultado já vem filtrado do servidor. */}
      <form method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nº do processo, título ou cliente..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Buscar
        </button>
        {q && (
          <Link
            href="/contracts"
            className="rounded-md px-3 py-2 text-sm text-gray-500 hover:underline"
          >
            Limpar
          </Link>
        )}
      </form>

      {error && (
        <p className="text-sm text-red-600">
          Erro ao carregar contratos: {error.message}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nº Processo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Título</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Etapa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Validade</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contracts?.map((c) => {
              const stage = c.stage_id ? stageById.get(c.stage_id) : null
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">
                    <Link href={`/contracts/${c.id}`} className="hover:underline">
                      {c.process_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.title}</td>
                  <td className="px-4 py-3 text-gray-700">{c.client_name}</td>
                  <td className="px-4 py-3">
                    {stage ? (
                      <span className="rounded-full px-2 py-1 text-xs" style={{ backgroundColor: stage.color + '20', color: stage.color }}>
                        {stage.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Sem funil ativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ValidityBadge validUntil={validUntilById.get(c.id) ?? null} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.value || 0)}
                  </td>
                </tr>
              )
            })}

            {contracts?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {q ? `Nenhum contrato encontrado para "${q}".` : 'Nenhum contrato cadastrado ainda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
