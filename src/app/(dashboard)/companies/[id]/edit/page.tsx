import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EditCompanyForm } from '@/components/companies/edit-company-form'

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, trade_name, cnpj, notes')
    .eq('id', id)
    .single()

  if (!company) notFound()

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/companies/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar
      </Link>
      <h1 className="text-[17px] font-medium text-foreground">Editar Empresa</h1>
      <EditCompanyForm companyId={id} initial={company} />
    </div>
  )
}
