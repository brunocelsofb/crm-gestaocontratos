import { createAdminClient } from '@/lib/supabase/admin'
import { NpsForm } from '@/components/nps/nps-form'

export default async function NpsPublicPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const adminClient = createAdminClient()

  const { data: survey } = await adminClient
    .from('nps_surveys')
    .select('id, status, contract_id')
    .eq('token', token)
    .maybeSingle()

  let companyName = ''
  if (survey) {
    const { data: contract } = await adminClient
      .from('contracts')
      .select('client_name, company_id')
      .eq('id', survey.contract_id)
      .maybeSingle()

    companyName = contract?.client_name ?? ''

    if (contract?.company_id) {
      const { data: company } = await adminClient
        .from('companies')
        .select('name')
        .eq('id', contract.company_id)
        .maybeSingle()
      if (company?.name) companyName = company.name
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {!survey ? (
          <p className="text-center text-sm text-gray-500">
            Este link de pesquisa não é válido. Se você acredita que isso é um erro, entre em contato com quem enviou o link.
          </p>
        ) : survey.status === 'answered' ? (
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Obrigado!</p>
            <p className="mt-1 text-sm text-gray-500">Sua resposta a esta pesquisa já foi registrada anteriormente.</p>
          </div>
        ) : (
          <NpsForm token={token} companyName={companyName} />
        )}
      </div>
    </div>
  )
}
