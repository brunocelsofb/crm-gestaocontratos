import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { StageBar } from '@/components/contracts/stage-bar'
import { Timeline } from '@/components/contracts/timeline'
import { ActivityFeed } from '@/components/activities/activity-feed'
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
import { InlineValueEditor } from '@/components/contracts/inline-value-editor'
import { ProposalsSection } from '@/components/proposals/proposals-section'
import { ContractTicketsSection } from '@/components/tickets/contract-tickets-section'
import { ContractEmailSection } from '@/components/email/contract-email-section'
import { ContractCustomFieldsSection } from '@/components/custom-fields/contract-custom-fields-section'
import { ContractContactsSection } from '@/components/contracts/contract-contacts-section'
import { ContractZapSignSection } from '@/components/zapsign/contract-zapsign-section'
import { PortfolioFieldsForm } from '@/components/carteira/portfolio-fields-form'
import { getContractContacts } from '@/lib/actions/contract-contacts'
import { ContractWhatsAppSection } from '@/components/whatsapp/contract-whatsapp-section'
import { getConnectedEmailAccount } from '@/lib/actions/email'
import { getContractCustomFieldValues } from '@/lib/actions/custom-fields'
import { DeleteContractButton } from '@/components/contracts/delete-contract-button'
import { ActionPlanSection } from '@/components/contracts/action-plan-section'
import { DimensioningSection } from '@/components/contracts/dimensioning-section'
import { ContractTabs } from '@/components/contracts/contract-tabs'
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
    { data: proposals },
    { data: catalogItems },
  ] = await Promise.all([
    contract.company_id
      ? supabase.from('companies').select('id, name').eq('id', contract.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contract.contact_id
      ? supabase.from('contacts').select('id, name, role, email, phone').eq('id', contract.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('pipeline_runs').select('*').eq('contract_id', id).order('started_at', { ascending: true }),
    supabase.from('activities').select('id, type, activity_type, title, content, status, activity_date, activity_time, duration_minutes, created_at, due_date, completed, user_id, assigned_to, metadata').eq('contract_id', id).order('created_at', { ascending: false }),
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
    supabase.from('proposals').select('id, control_code, status, version, created_at').eq('contract_id', id).order('created_at', { ascending: false }),
    supabase.from('proposal_catalog_items').select('id, name, category, type, characteristics, unit_value').order('name'),
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

  const [{ data: emailTemplates }, { data: contractEmails }, connectedEmailAccount, { data: orgEmailSettings }, { data: customFields }, customFieldValues, { data: orgWhatsAppSettings }, { data: whatsappTemplates }, { data: whatsappMessages }, contractContacts, { data: companyAllContacts }, { data: zapsignTemplates }, { data: zapsignDocuments }, { data: orgZapSignSettings }] = await Promise.all([
    supabase.from('email_templates').select('id, name').eq('context', 'contract').eq('channel', 'email').order('name'),
    supabase.from('contract_emails').select('id, from_email, to_email, cc_email, bcc_email, subject, body, sent_at, status, triggered_automatically, error_message, opened_at, direction').eq('contract_id', contract.id).order('sent_at', { ascending: false }),
    getConnectedEmailAccount().catch(() => null),
    supabase.from('organization_settings').select('inbound_email_domain').eq('id', 'default').maybeSingle(),
    supabase.from('custom_fields').select('id, name, field_key, field_type, select_options').order('name'),
    getContractCustomFieldValues(contract.id).catch(() => ({} as Record<string, string>)),
    supabase.from('organization_settings').select('zapi_instance_id').eq('id', 'default').maybeSingle(),
    supabase.from('email_templates').select('id, name').eq('context', 'contract').eq('channel', 'whatsapp').order('name'),
    supabase.from('contract_whatsapp_messages').select('id, phone, message, direction, status, triggered_automatically, error_message, created_at, media_url, media_type, media_filename, sender_photo_url, delivery_status, sent_by, profiles(full_name)').eq('contract_id', contract.id).order('created_at', { ascending: false }),
    getContractContacts(contract.id),
    contract.company_id
      ? supabase.from('contacts').select('id, name, role').eq('company_id', contract.company_id).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; role: string | null }[] }),
    supabase.from('zapsign_templates').select('id, name, type').order('name'),
    supabase.from('zapsign_documents').select('id, name, status, sent_at, signed_at, pdf_url, signed_pdf_url').eq('contract_id', contract.id).order('created_at', { ascending: false }),
    supabase.from('organization_settings').select('zapsign_api_token').eq('id', 'default').maybeSingle(),
  ])

  const inboundEmailAddress =
    orgEmailSettings?.inbound_email_domain && contract.inbound_email_code
      ? `${contract.inbound_email_code}@${orgEmailSettings.inbound_email_domain}`
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/pipeline" style={{ fontSize: 12, color: '#8892a4', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ← Voltar para o Funil
      </Link>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{contract.client_name}</h1>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#f1f3f8', color: '#52514e' }}>{contract.title}</span>
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
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: '#eef3ff', color: '#3b5bdb' }}>
                  🔄 Renovação automática
                </span>
              )}
            </div>
            <p style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, color: '#b0b8c8' }}>{contract.process_number}</p>
            {linkedCompany && (
              <Link href={`/companies/${linkedCompany.id}`} style={{ marginTop: 4, display: 'inline-block', fontSize: 12, color: '#4f86f7', textDecoration: 'none' }}>
                {linkedCompany.name} →
              </Link>
            )}
            {linkedContact && (
              <p style={{ marginTop: 4, fontSize: 12, color: '#8892a4' }}>
                {linkedContact.name}
                {linkedContact.role ? ` · ${linkedContact.role}` : ''}
                {linkedContact.email ? ` · ${linkedContact.email}` : ''}
                {linkedContact.phone ? ` · ${linkedContact.phone}` : ''}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link href={`/contracts/${contract.id}/edit`} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', textDecoration: 'none' }}>
              {isCurrentlyInContractsPipeline ? 'Editar contrato' : 'Editar oportunidade'}
            </Link>
            {currentProfile?.role === 'admin' && (
              <DeleteContractButton
                contractId={contract.id}
                label={isCurrentlyInContractsPipeline ? 'Excluir contrato' : 'Excluir oportunidade'}
              />
            )}
          </div>
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
          pipelineType={pipelineById.get(displayRun.pipeline_id)?.type}
        />
      ) : (
        <p style={{ borderRadius: 10, background: '#f8f9fb', padding: 16, fontSize: 13, color: '#8892a4' }}>
          Este contrato não tem nenhuma passagem de funil em aberto no momento.
        </p>
      )}

      <ContractTabs
        tabs={[
          {
            id: 'visao-geral',
            label: 'Visão Geral',
            content: (
              <div className="space-y-6">
                {isCurrentlyInContractsPipeline && displayRun && (
                  <RenewalValueSection contractId={contract.id} currentValue={Number(displayRun.value) || 0} canEdit={canChangeStage} />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {/* Valor com botão de alterar inline em Novos Negócios */}
                  <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 14, border: '0.5px solid #e8edf5' }}>
                    <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>
                      {isCurrentlyInContractsPipeline ? 'Valor do contrato' : 'Valor estimado'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayRun?.value || 0)}
                      </p>
                      {canChangeStage && (
                        <InlineValueEditor contractId={contract.id} currentValue={Number(displayRun?.value) || 0} />
                      )}
                    </div>
                  </div>
                  {/* Vigência só em Gestão de Contratos */}
                  {isCurrentlyInContractsPipeline ? (
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 14, border: '0.5px solid #e8edf5' }}>
                      <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Vigência</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
                        {contract.valid_until
                          ? `${contract.valid_from ? new Date(contract.valid_from).toLocaleDateString('pt-BR') : '?'} → ${new Date(contract.valid_until).toLocaleDateString('pt-BR')}`
                          : 'Não informada'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 14, border: '0.5px solid #e8edf5' }}>
                      <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Previsão de fechamento</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
                        {displayRun?.expected_close_date
                          ? new Date(displayRun.expected_close_date).toLocaleDateString('pt-BR')
                          : 'Não informada'}
                      </p>
                    </div>
                  )}
                  <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 14, border: '0.5px solid #e8edf5' }}>
                    <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Aberto desde</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
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

                <ContractContactsSection contractId={contract.id} contacts={contractContacts} companyContacts={companyAllContacts ?? []} />

                <ContractCustomFieldsSection contractId={contract.id} fields={customFields ?? []} values={customFieldValues} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <NoteForm contractId={contract.id} />
                  <Timeline activities={activities} />
                </div>
              </div>
            ),
          },
          {
            id: 'atividades',
            label: 'Atividades',
            content: (
              <ActivityFeed
                activities={(activities ?? []).filter((a: any) => !['stage_change','pipeline_change','automation_triggered','system','transfer'].includes(a.type))}
                contractId={contract.id}
                companyId={contract.company_id ?? null}
                pipelineRunId={displayRun?.id ?? null}
                profiles={allProfiles ?? []}
                currentUserId={currentProfile?.id ?? ''}
              />
            ),
          },

          {
            id: 'responsavel',
            label: 'Responsável & Transferências',
            content: (
              <DepartmentSection
                contractId={contract.id}
                currentDepartment={contract.current_department}
                currentAssigneeName={currentAssigneeName}
                hasPrevious={hasPreviousResponsible}
                users={(allProfiles ?? []).filter((p) => p.department)}
                transfers={transferLog}
              />
            ),
          },
          {
            id: 'plano-de-acao',
            label: 'Plano de Ação',
            content: <ActionPlanSection contractId={contract.id} items={actionPlanItems ?? []} />,
          },
          {
            id: 'propostas',
            label: 'Propostas',
            content: (
              <div className="space-y-6">
                <ProposalsSection contractId={contract.id} proposals={proposals ?? []} catalogItems={catalogItems ?? []} />
                {isCurrentlyInSalesPipeline && (
                  <DimensioningSection contractId={contract.id} reviews={dimensioningReviews ?? []} />
                )}
              </div>
            ),
          },
          ...(isCurrentlyInContractsPipeline
            ? [
                {
                  id: 'faturamento',
                  label: 'Faturamento',
                  content: <BillingSection contractId={contract.id} billingType={contract.billing_type} records={billingRecords ?? []} />,
                },
              ]
            : []),
          // Pesquisas & NPS: só em Gestão de Contratos (NPS + Pesquisa)
          // e Serviço Avulso (só Pesquisa, ativada ao marcar Ganho)
          // Funil de Vendas recorrente: NEM NPS NEM Pesquisa
          ...(!isCurrentlyInSalesPipeline ? [{
            id: 'pesquisas',
            label: isCurrentlyInContractsPipeline ? 'Pesquisas & NPS' : 'Pesquisa',
            content: (
              <div className="space-y-6">
                {isCurrentlyInContractsPipeline && (
                  <NpsSection contractId={contract.id} surveys={npsSurveys ?? []} linkBase={linkBase} />
                )}
                <CustomSurveysSection
                  contractId={contract.id}
                  templates={availableTemplates}
                  allTemplates={allSurveyTemplates ?? []}
                  sentSurveys={sentCustomSurveys ?? []}
                  linkBase={linkBase}
                />
              </div>
            ),
          }] : []),
          {
            id: 'arquivos',
            label: 'Arquivos',
            content: <FilesSection contractId={contract.id} initialFiles={contractFiles ?? []} />,
          },
          {
            id: 'atendimento',
            label: 'Atendimento',
            content: <ContractTicketsSection contractId={contract.id} clientName={contract.client_name} />,
          },
          {
            id: 'email',
            label: 'E-mail',
            content: (
              <ContractEmailSection
                contractId={contract.id}
                hasGmailConnected={!!connectedEmailAccount}
                templates={emailTemplates ?? []}
                defaultToEmail={linkedContact?.email ?? null}
                emailLog={contractEmails ?? []}
                inboundEmailAddress={inboundEmailAddress}
              />
            ),
          },
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            content: (
              <ContractWhatsAppSection
                contractId={contract.id}
                isConnected={!!orgWhatsAppSettings?.zapi_instance_id}
                templates={whatsappTemplates ?? []}
                defaultPhone={linkedContact?.phone ?? null}
                messageLog={(whatsappMessages ?? []).map((m: any) => ({ ...m, sent_by_name: m.profiles?.full_name ?? null }))}
              />
            ),
          },
          {
            id: 'zapsign',
            label: '✍️ Assinatura',
            content: (
              <ContractZapSignSection
                contractId={contract.id}
                templates={zapsignTemplates ?? []}
                documents={zapsignDocuments ?? []}
                defaultContactName={linkedContact?.name ?? null}
                defaultContactEmail={linkedContact?.email ?? null}
                defaultContactPhone={linkedContact?.phone ?? null}
                isConnected={!!orgZapSignSettings?.zapsign_api_token}
              />
            ),
          },
          ...(isCurrentlyInContractsPipeline ? [{
            id: 'carteira',
            label: '📋 Dados da Carteira',
            content: (
              <PortfolioFieldsForm
                contractId={contract.id}
                initial={{
                  contract_number: (contract as any).contract_number ?? null,
                  sankhya_code: (contract as any).sankhya_code ?? null,
                  cnpj_billing: (contract as any).cnpj_billing ?? null,
                  contract_type: (contract as any).contract_type ?? null,
                  monthly_value: (contract as any).monthly_value ?? null,
                  validity_months: (contract as any).validity_months ?? null,
                  valid_until: (contract as any).valid_until ?? null,
                  engineer_name: (contract as any).engineer_name ?? null,
                  coordinator_name: (contract as any).coordinator_name ?? null,
                  abc_curve: (contract as any).abc_curve ?? null,
                  sphere: (contract as any).sphere ?? null,
                  segment: (contract as any).segment ?? null,
                  economic_group: (contract as any).economic_group ?? null,
                  nature: (contract as any).nature ?? null,
                  region: (contract as any).region ?? null,
                  uf: (contract as any).uf ?? null,
                  score_billing: (contract as any).score_billing ?? null,
                  score_visit: (contract as any).score_visit ?? null,
                  score_loyalty: (contract as any).score_loyalty ?? null,
                  score_weight: (contract as any).score_weight ?? null,
                  has_measurement: (contract as any).has_measurement ?? false,
                  has_audit: (contract as any).has_audit ?? false,
                  has_parts: (contract as any).has_parts ?? false,
                  team_type: (contract as any).team_type ?? null,
                  municipality: (contract as any).municipality ?? null,
                  state: (contract as any).state ?? null,
                  internal_notes: (contract as any).internal_notes ?? null,
                }}
                contractNature={(contract as any).nature ?? null}
              />
            ),
          }] : []),
        ]}
      />
    </div>
  )
}
