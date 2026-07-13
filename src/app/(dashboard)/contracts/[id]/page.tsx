import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { StageBar } from '@/components/contracts/stage-bar'
import { Timeline } from '@/components/contracts/timeline'
import { NoteForm } from '@/components/contracts/note-form'
import { NpsSection } from '@/components/nps/nps-section'
import { FilesSection } from '@/components/contracts/files-section'
import { CustomSurveysSection } from '@/components/surveys/custom-surveys-section'
import { ValidityBadge } from '@/components/contracts/validity-badge'
import { ContractTagSelect } from '@/components/tags/contract-tag-select'
import { DepartmentSection } from '@/components/contracts/department-section'
import { AccountOwnerBadge } from '@/components/contracts/account-owner-badge'
import { BillingSection } from '@/components/contracts/billing-section'
import { RenewalValueSection } from '@/components/contracts/renewal-value-section'
import { DeleteContractButton } from '@/components/contracts/delete-contract-button'
import { ActionPlanSection } from '@/components/contracts/action-plan-section'
import { DimensioningSection } from '@/components/contracts/dimensioning-section'
import { setContractTag } from '@/lib/actions/tags'
import { getCurrentProfile } from '@/lib/auth/role'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  // PERFORMANCE: estas 4 consultas não dependem umas das outras (só do
  // contrato já carregado acima), então saem em paralelo em vez de uma
  // esperar a outra — reduz bastante o tempo de carregar esta tela.
  const [
    { data: linkedCompany },
    { data: linkedContact },
    { data: runs },
    { data: activitiesRaw },
    { data: contractFiles },
    { data: allTags },
    { data: currentContractTags },
    { data: npsSurveys },
    { data: allSurveyTemplates },
    { data: sentCustomSurveys },
    { data: actionPlanItems },
    { data: dimensioningReviews },
    { data: allProfiles },
    { data: billingRecords },
  ] = await Promise.all([
    contract.company_id
      ? supabase.from('companies').select('id, name').eq('id', contract.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contract.contact_id
      ? supabase.from('contacts').select('id, name, role, email, phone').eq('id', contract.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('pipeline_runs').select('*').eq('contract_id', id).order('started_at', { ascending: true }),
    supabase.from('activities').select('id, type, content, created_at, due_date, completed, user_id').eq('contract_id', id).order('created_at', { ascending: false }),
    supabase.from('contract_files').select('id, file_name, storage_path, file_size, mime_type, created_at').eq('contract_id', id).order('created_at', { ascending: false }),
    supabase.from('tags').select('id, name, color').order('name'),
    supabase.from('contract_tags').select('tag_id').eq('contract_id', id),
    supabase.from('nps_surveys').select('id, token, score, comment, status, sent_at, answered_at, respondent_name, respondent_email, respondent_phone').eq('contract_id', id).order('sent_at', { ascending: false }),
    supabase.from('survey_templates').select('id, name, tag_id, questions').order('name'),
    supabase.from('custom_surveys').select('id, token, status, sent_at, answered_at, respondent_name, respondent_email, respondent_phone, template_id, responses').eq('contract_id', id).order('sent_at', { ascending: false }),
    supabase.from('action_plan_items').select('id, description, responsible_department, status, created_at, resolved_at').eq('contract_id', id).order('created_at', { ascending: false }),
    supabase.from('dimensioning_reviews').select('id, file_storage_path, file_name, sent_at, status, reviewed_at, review_notes').eq('contract_id', id).order('sent_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, department'),
    supabase.from('billing_records').select('id, year, month, amount, file_storage_path, file_name, notes, confirmed_at').eq('contract_id', id).order('year', { ascending: false }).order('month', { ascending: false }),
  ])

  const currentTagId = currentContractTags?.[0]?.tag_id ?? null

  // Só mostra formulários sem tag (gerais) ou da MESMA tag do contrato.
  const availableTemplates = (allSurveyTemplates ?? []).filter((t) => !t.tag_id || t.tag_id === currentTagId)

  // NOTA DE INCERTEZA: mesmo aviso de sempre — uso o header "host" pra
  // montar o link absoluto, funciona bem na Vercel mas não testei em
  // outros ambientes de hospedagem.
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const linkBase = `${host.includes('localhost') ? 'http' : 'https'}://${host}`

  const openRun = runs?.find((r) => r.status === 'open')
  const lastRun = runs && runs.length > 0 ? runs[runs.length - 1] : undefined
  const displayRun = openRun ?? lastRun

  const pipelineIds = [...new Set((runs ?? []).map((r) => r.pipeline_id))]
  const runIds = (runs ?? []).map((r) => r.id)
  const userIds = [...new Set((activitiesRaw ?? []).map((a) => a.user_id).filter((v): v is string => !!v))]

  // PERFORMANCE: mesma lógica — estas 4 também não dependem umas das
  // outras, só dos resultados acima.
  const [
    { data: pipelines },
    { data: stages },
    { data: history },
    { data: activityProfiles },
  ] = await Promise.all([
    pipelineIds.length
      ? supabase.from('pipelines').select('id, name, won_label, lost_label, type').in('id', pipelineIds)
      : Promise.resolve({ data: [] as { id: string; name: string; won_label: string; lost_label: string; type: string }[] }),
    displayRun
      ? supabase.from('stages').select('id, name, order_index, is_won, is_lost, sla_days, color').eq('pipeline_id', displayRun.pipeline_id).order('order_index')
      : Promise.resolve({ data: [] as { id: string; name: string; order_index: number; is_won: boolean; is_lost: boolean; sla_days: number | null; color: string | null }[] }),
    runIds.length
      ? supabase.from('stage_history').select('pipeline_run_id, stage_id, entered_at, exited_at, duration_seconds').in('pipeline_run_id', runIds)
      : Promise.resolve({ data: [] as { pipeline_run_id: string; stage_id: string; entered_at: string; exited_at: string | null; duration_seconds: number | null }[] }),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])

  const pipelineById = new Map((pipelines ?? []).map((p) => [p.id, p]))
  const profileById = new Map((activityProfiles ?? []).map((p) => [p.id, p.full_name]))
  const isCurrentlyInSalesPipeline = displayRun ? pipelineById.get(displayRun.pipeline_id)?.type === 'vendas' : false
  const isCurrentlyInContractsPipeline = displayRun ? pipelineById.get(displayRun.pipeline_id)?.type === 'gestao_contratos' : false

  const activities = (activitiesRaw ?? []).map((a) => ({
    ...a,
    profiles: a.user_id ? { full_name: profileById.get(a.user_id) ?? '' } : null,
  }))

  const allProfilesById = new Map((allProfiles ?? []).map((p) => [p.id, p]))
  const currentAssigneeName = contract.current_assignee_id
    ? allProfilesById.get(contract.current_assignee_id)?.full_name ?? null
    : null
  const accountOwnerName = contract.owner_id ? allProfilesById.get(contract.owner_id)?.full_name ?? null : null
  const hasPreviousResponsible = !!contract.previous_department

  // "Dono da conta" (owner_id) é fixo/de longo prazo — diferente de
  // "responsável agora" (current_assignee_id), que é só a tratativa
  // pontual do momento e NÃO dá poder de mudar etapa.
  const currentProfile = await getCurrentProfile()
  const canChangeStage =
    contract.owner_id === currentProfile?.id || currentProfile?.role === 'admin'

  const transferLog = activities
    .filter((a) => a.type === 'transfer')
    .map((a) => ({
      id: a.id,
      content: a.content,
      created_at: a.created_at,
      user_name: a.profiles?.full_name ?? null,
    }))

  // Dias por etapa, calculados apenas dentro da run aberta atual
  // (a barra de pipeline mostra só o funil em andamento no momento).
  const timings = (stages ?? []).map((stage) => {
    const rows = (history ?? []).filter((h) => h.pipeline_run_id === displayRun?.id && h.stage_id === stage.id)
    if (rows.length === 0) return { stageId: stage.id, days: null, isOverdue: false }

    const totalSeconds = rows.reduce((sum, r) => {
      if (r.duration_seconds !== null) return sum + r.duration_seconds
      return sum + Math.round((Date.now() - new Date(r.entered_at).getTime()) / 1000)
    }, 0)

    const days = Math.floor(totalSeconds / 86_400)
    const isOverdue = stage.sla_days !== null && days > stage.sla_days
    return { stageId: stage.id, days, isOverdue }
  })

  return (
    <div className="space-y-6">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700"
      >
        ← Voltar para o Funil
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">{contract.client_name}</h1>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{contract.title}</span>
            <ValidityBadge validUntil={contract.valid_until} />
            <ContractTagSelect
              key={currentTagId ?? 'none'}
              tags={allTags ?? []}
              currentTagId={currentTagId}
              action={setContractTag.bind(null, contract.id)}
            />
            <AccountOwnerBadge
              contractId={contract.id}
              ownerName={accountOwnerName}
              isAdmin={currentProfile?.role === 'admin'}
              users={(allProfiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name }))}
            />
            {contract.auto_renewal && (
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                🔄 Renovação automática
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">{contract.process_number}</p>
          {linkedCompany && (
            <Link href={`/companies/${linkedCompany.id}`} className="mt-1 inline-block text-xs text-brand-700 hover:underline">
              {linkedCompany.name} →
            </Link>
          )}
          {linkedContact && (
            <p className="mt-1 text-xs text-gray-500">
              Contato: {linkedContact.name}
              {linkedContact.role ? ` (${linkedContact.role})` : ''}
              {linkedContact.email ? ` · ${linkedContact.email}` : ''}
              {linkedContact.phone ? ` · ${linkedContact.phone}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <Link
            href={`/contracts/${contract.id}/edit`}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Editar
          </Link>
          {currentProfile?.role === 'admin' && <DeleteContractButton contractId={contract.id} />}
        </div>
      </div>

      {displayRun && stages && stages.length > 0 ? (
        <StageBar
          contractId={contract.id}
          stages={stages}
          currentStageId={displayRun.stage_id}
          timings={timings}
          status={displayRun.status}
          wonLabel={pipelineById.get(displayRun.pipeline_id)?.won_label ?? 'Ganho'}
          lostLabel={pipelineById.get(displayRun.pipeline_id)?.lost_label ?? 'Perdido'}
          canChangeStage={canChangeStage}
        />
      ) : (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          Este contrato não tem nenhuma passagem de funil em aberto no momento.
        </p>
      )}

      {isCurrentlyInContractsPipeline && displayRun && (
        <RenewalValueSection contractId={contract.id} currentValue={Number(displayRun.value) || 0} />
      )}

      <DepartmentSection
        contractId={contract.id}
        currentDepartment={contract.current_department}
        currentAssigneeName={currentAssigneeName}
        hasPrevious={hasPreviousResponsible}
        users={(allProfiles ?? []).filter((p) => p.department)}
        transfers={transferLog}
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Valor (run atual)</p>
          <p className="text-sm font-medium text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayRun?.value || 0)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Vigência do contrato</p>
          <p className="text-sm font-medium text-gray-900">
            {contract.valid_until
              ? `${contract.valid_from ? new Date(contract.valid_from).toLocaleDateString('pt-BR') : '?'} → ${new Date(contract.valid_until).toLocaleDateString('pt-BR')}`
              : 'Não informado'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Previsão de fechamento</p>
          <p className="text-sm font-medium text-gray-900">
            {displayRun?.expected_close_date
              ? new Date(displayRun.expected_close_date).toLocaleDateString('pt-BR')
              : 'Não informado'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Aberto desde</p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(contract.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {runs && runs.length > 1 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-900">Jornada entre funis</h2>
          <div className="space-y-2">
            {runs.map((r) => {
              const previous = r.previous_run_id ? runs.find((x) => x.id === r.previous_run_id) : null
              const currentValue = Number(r.value) || 0
              const previousValue = previous ? Number(previous.value) || 0 : null
              const pctChange =
                previousValue !== null && previousValue > 0
                  ? Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10
                  : null

              return (
                <div key={r.id} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{pipelineById.get(r.pipeline_id)?.name}</span>
                      <span className="ml-2 text-gray-400">
                        {new Date(r.started_at).toLocaleDateString('pt-BR')}
                        {r.ended_at ? ` → ${new Date(r.ended_at).toLocaleDateString('pt-BR')}` : ' → em andamento'}
                      </span>
                    </div>
                    <span
                      className={
                        r.status === 'won'
                          ? 'text-emerald-600'
                          : r.status === 'lost'
                            ? 'text-red-600'
                            : r.status === 'moved'
                              ? 'text-gray-400'
                              : 'text-blue-600'
                      }
                    >
                      {(
                        { open: 'Em andamento', won: 'Ganho', lost: 'Perdido', moved: 'Movido para outro funil' } as Record<string, string>
                      )[r.status]}
                    </span>
                  </div>
                  {currentValue > 0 && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {previousValue !== null ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previousValue)} → ` : ''}
                        <span className="font-medium text-gray-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentValue)}
                        </span>
                      </span>
                      {pctChange !== null && (
                        <span className={pctChange >= 0 ? 'text-positive-700' : 'text-negative-700'}>
                          ({pctChange >= 0 ? '+' : ''}{pctChange}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ActionPlanSection contractId={contract.id} items={actionPlanItems ?? []} />

      {isCurrentlyInSalesPipeline && (
        <DimensioningSection contractId={contract.id} reviews={dimensioningReviews ?? []} />
      )}

      {isCurrentlyInContractsPipeline && (
        <BillingSection contractId={contract.id} billingType={contract.billing_type} records={billingRecords ?? []} />
      )}

      <NpsSection contractId={contract.id} surveys={npsSurveys ?? []} linkBase={linkBase} />

      <CustomSurveysSection
        contractId={contract.id}
        templates={availableTemplates}
        allTemplates={allSurveyTemplates ?? []}
        sentSurveys={sentCustomSurveys ?? []}
        linkBase={linkBase}
      />

      <FilesSection contractId={contract.id} initialFiles={contractFiles ?? []} />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Histórico e atividades</h2>
        <NoteForm contractId={contract.id} />
        <Timeline activities={activities} />
      </div>
    </div>
  )
}
