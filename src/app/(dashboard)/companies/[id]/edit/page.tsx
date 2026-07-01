import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
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
      <h1 className="text-[17px] font-medium text-foreground">Editar Empresa</h1>
      <EditCompanyForm companyId={id} initial={company} />
    </div>
  )
}
