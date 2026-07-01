import { createClient } from '@/lib/supabase/server'
import { StageBar } from '@/components/contracts/stage-bar'
import { Timeline } from '@/components/contracts/timeline'
import { NoteForm } from '@/components/contracts/note-form'
import { notFound } from 'next/navigation'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // NOTA: em versões recentes do Next.js, `params` é uma Promise em
  // Server Components. Se sua versão usar o formato antigo (objeto
  // direto), remova o `await` abaixo — confirme testando localmente.
  const { id } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  // Busca TODAS as pipeline_runs do contrato (não só a aberta) para
  // montar a "jornada entre funis" — isso é o que preserva a visão
  // de "saiu de um funil e entrou em outro" que você pediu.
  const { data: runs } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('contract_id', id)
    .order('started_at', { ascending: true })

  const openRun = runs?.find((r) => r.status === 'open')
  const pipelineIds = [...new Set((runs ?? []).map((r) => r.pipeline_id))]

  const { data: pipelines } = pipelineIds.length
    ? await supabase.from('pipelines').select('id, name').in('id', pipelineIds)
    : { data: [] }
  const pipelineById = new Map((pipelines ?? []).map((p) => [p.id, p]))

  const { data: stages } = openRun
    ? await supabase
        .from('stages')
        .select('id, name, order_index, is_won, is_lost, sla_days, color')
        .eq('pipeline_id', openRun.pipeline_id)
        .order('order_index')
    : { data: [] }

  const runIds = (runs ?? []).map((r) => r.id)
  const { data: history } = runIds.length
    ? await supabase
        .from('stage_history')
        .select('pipeline_run_id, stage_id, entered_at, exited_at, duration_seconds')
        .in('pipeline_run_id', runIds)
    : { data: [] }

  const { data: activitiesRaw } = await supabase
    .from('activities')
    .select('id, type, content, created_at, due_date, completed, user_id')
    .eq('contract_id', id)
    .order('created_at', { ascending: false })

  const userIds = [...new Set((activitiesRaw ?? []).map((a) => a.user_id).filter((v): v is string => !!v))]
  const { data: activityProfiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const profileById = new Map((activityProfiles ?? []).map((p) => [p.id, p.full_name]))

  const activities = (activitiesRaw ?? []).map((a) => ({
    ...a,
    profiles: a.user_id ? { full_name: profileById.get(a.user_id) ?? '' } : null,
  }))

  // Dias por etapa, calculados apenas dentro da run aberta atual
  // (a barra de pipeline mostra só o funil em andamento no momento).
  const timings = (stages ?? []).map((stage) => {
    const rows = (history ?? []).filter((h) => h.pipeline_run_id === openRun?.id && h.stage_id === stage.id)
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
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-900">{contract.client_name}</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{contract.title}</span>
        </div>
        <p className="mt-1 font-mono text-sm text-gray-500">{contract.process_number}</p>
      </div>

      {openRun && stages && stages.length > 0 ? (
        <StageBar
          contractId={contract.id}
          stages={stages}
          currentStageId={openRun.stage_id}
          timings={timings}
          status={openRun.status}
        />
      ) : (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          Este contrato não tem nenhuma passagem de funil em aberto no momento.
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Valor (run atual)</p>
          <p className="text-sm font-medium text-gray-900">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(openRun?.value || 0)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Previsão de fechamento</p>
          <p className="text-sm font-medium text-gray-900">
            {openRun?.expected_close_date
              ? new Date(openRun.expected_close_date).toLocaleDateString('pt-BR')
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
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
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
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Histórico e atividades</h2>
        <NoteForm contractId={contract.id} />
        <Timeline activities={activities} />
      </div>
    </div>
  )
}
