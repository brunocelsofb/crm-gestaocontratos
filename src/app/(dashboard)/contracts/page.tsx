import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Server Component: busca os dados direto no servidor, sem useEffect
// nem loading state no client — reduz JS enviado ao navegador.

export default async function ContractsPage() {
  const supabase = await createClient()

  // NOTA DE INCERTEZA: o Supabase/PostgREST resolve "embedding" (o join
  // automático tipo `stages(name)`) baseado em foreign keys DECLARADAS
  // nas tabelas. Não tenho certeza se isso funciona de forma confiável
  // quando a origem é uma VIEW (contracts_with_current_run) em vez de
  // uma tabela real — pode não detectar a relação. Para não arriscar
  // quebrar em produção, faço em duas consultas simples e junto os
  // dados aqui no servidor, em vez de depender de embedding sobre a view.

  const { data: contracts, error } = await supabase
    .from('contracts_with_current_run')
    .select('id, process_number, title, client_name, value, run_status, stage_id')
    .order('created_at', { ascending: false })

  const stageIds = [...new Set((contracts ?? []).map((c) => c.stage_id).filter(Boolean))]
  const { data: stages } = stageIds.length
    ? await supabase.from('stages').select('id, name, color').in('id', stageIds)
    : { data: [] }

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Contratos</h1>
        <Link
          href="/contracts/new"
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Novo Contrato
        </Link>
      </div>

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
                  <td className="px-4 py-3 text-right text-gray-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.value || 0)}
                  </td>
                </tr>
              )
            })}

            {contracts?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhum contrato cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
