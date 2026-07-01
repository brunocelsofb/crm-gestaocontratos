import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('companies')
    .select('id, name, cnpj, created_at')
    .order('name')

  if (q?.trim()) {
    const term = q.trim().replace(/[%_]/g, '')
    query = query.ilike('name', `%${term}%`)
  }

  const { data: companies, error } = await query

  const companyIds = (companies ?? []).map((c) => c.id)
  const { data: contractCounts } = companyIds.length
    ? await supabase.from('contracts').select('company_id').in('company_id', companyIds)
    : { data: [] }

  const countByCompany = new Map<string, number>()
  for (const c of contractCounts ?? []) {
    if (!c.company_id) continue
    countByCompany.set(c.company_id, (countByCompany.get(c.company_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Empresas</h1>
        <Link
          href="/companies/new"
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          + Nova Empresa
        </Link>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nome..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Buscar
        </button>
      </form>

      {error && <p className="text-sm text-red-600">Erro ao carregar empresas: {error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">CNPJ</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Contratos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/companies/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.cnpj || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">{countByCompany.get(c.id) ?? 0}</td>
              </tr>
            ))}
            {companies?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  {q ? `Nenhuma empresa encontrada para "${q}".` : 'Nenhuma empresa cadastrada ainda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
