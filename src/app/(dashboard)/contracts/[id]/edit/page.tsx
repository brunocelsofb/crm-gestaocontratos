import Link from 'next/link'
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
    .select('id, process_number, title, client_name, description, valid_from, valid_until, auto_renewal')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const { data: openRun } = await supabase
    .from('pipeline_runs')
    .select('value, expected_close_date, pipeline_id')
    .eq('contract_id', id)
    .eq('status', 'open')
    .maybeSingle()

  let pipelineType = 'gestao_contratos'
  if (openRun?.pipeline_id) {
    const { data: pipeline } = await supabase.from('pipelines').select('type').eq('id', openRun.pipeline_id).maybeSingle()
    if (pipeline) pipelineType = pipeline.type
  }

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/contracts/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar
      </Link>
      <h1 className="text-[17px] font-medium text-foreground">Editar Contrato</h1>
      <EditContractForm
        contractId={id}
        pipelineType={pipelineType}
        initial={{
          process_number: contract.process_number,
          title: contract.title,
          client_name: contract.client_name,
          description: contract.description,
          value: Number(openRun?.value) || 0,
          expected_close_date: openRun?.expected_close_date ?? null,
          hasOpenRun: !!openRun,
          valid_from: contract.valid_from,
          valid_until: contract.valid_until,
          auto_renewal: contract.auto_renewal,
        }}
      />
    </div>
  )
}
