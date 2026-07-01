import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { EditContractForm } from '@/components/contracts/edit-contract-form'

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, process_number, title, client_name, description')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const { data: openRun } = await supabase
    .from('pipeline_runs')
    .select('value, expected_close_date')
    .eq('contract_id', id)
    .eq('status', 'open')
    .maybeSingle()

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-[17px] font-medium text-foreground">Editar Contrato</h1>
      <EditContractForm
        contractId={id}
        initial={{
          process_number: contract.process_number,
          title: contract.title,
          client_name: contract.client_name,
          description: contract.description,
          value: Number(openRun?.value) || 0,
          expected_close_date: openRun?.expected_close_date ?? null,
          hasOpenRun: !!openRun,
        }}
      />
    </div>
  )
}
