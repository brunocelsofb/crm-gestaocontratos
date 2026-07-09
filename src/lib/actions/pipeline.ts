'use server'

// Move um contrato para uma nova etapa.
//
// Dois comportamentos diferentes, dependendo de para onde vai:
//
// A) Nova etapa está no MESMO pipeline da run aberta atual:
//    apenas avança/retrocede a etapa dentro da mesma pipeline_run.
//
// B) Nova etapa está em OUTRO pipeline:
//    encerra a run atual (status = 'moved', ended_at preenchido —
//    o histórico completo dela fica preservado, nunca é apagado)
//    e cria uma NOVA pipeline_run no pipeline de destino, linkada
//    via previous_run_id. Isso é o que garante que dá pra analisar
//    depois "quantos processos passaram pelo funil comercial antes
//    de ir pro jurídico", sem perder o rastro.
//
// LIMITAÇÃO CONHECIDA: automações encadeadas podem formar loop —
// há um limite de profundidade (_depth) como proteção mínima.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type MoveResult = { success?: true; error?: string }

export async function moveContractStage(
  contractId: string,
  newStageId: string,
  _depth = 0
): Promise<MoveResult> {
  if (_depth > 5) {
    return { error: 'Cadeia de automações excedeu o limite de segurança (possível loop).' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const { data: run, error: runError } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('contract_id', contractId)
    .eq('status', 'open')
    .maybeSingle()

  if (runError || !run) {
    return { error: 'Este contrato não tem uma passagem de funil aberta no momento.' }
  }

  const { data: newStage, error: stageError } = await supabase
    .from('stages')
    .select('id, name, pipeline_id, is_won, is_lost')
    .eq('id', newStageId)
    .single()

  if (stageError || !newStage) return { error: 'Etapa não encontrada.' }

  const now = new Date().toISOString()

  // Fecha o registro de tempo-na-etapa aberto da run atual (sempre acontece,
  // independente de mudar de etapa dentro do mesmo funil ou trocar de funil).
  const { data: openHistory } = await supabase
    .from('stage_history')
    .select('id, entered_at')
    .eq('pipeline_run_id', run.id)
    .is('exited_at', null)
    .maybeSingle()

  if (openHistory) {
    const enteredAtMs = new Date(openHistory.entered_at).getTime()
    const durationSeconds = Math.round((Date.now() - enteredAtMs) / 1000)
    await supabase
      .from('stage_history')
      .update({ exited_at: now, duration_seconds: durationSeconds })
      .eq('id', openHistory.id)
  }

  const samePipeline = newStage.pipeline_id === run.pipeline_id
  let activeRunId = run.id

  if (samePipeline) {
    // --- Caso A: continua na mesma run, só muda a etapa ---
    await supabase.from('stage_history').insert({
      pipeline_run_id: run.id,
      stage_id: newStage.id,
      entered_at: now,
      changed_by: user.id,
    })

    const runUpdate: Record<string, unknown> = {
      stage_id: newStage.id,
      stage_entered_at: now,
    }
    if (newStage.is_won) {
      runUpdate.status = 'won'
      runUpdate.ended_at = now
    }
    if (newStage.is_lost) {
      runUpdate.status = 'lost'
      runUpdate.ended_at = now
    }

    await supabase.from('pipeline_runs').update(runUpdate).eq('id', run.id)

    await supabase.from('activities').insert({
      contract_id: contractId,
      pipeline_run_id: run.id,
      user_id: user.id,
      type: 'stage_change',
      content: `Movido para a etapa "${newStage.name}".`,
      metadata: { from_stage: run.stage_id, to_stage: newStage.id },
    })
  } else {
    // --- Caso B: troca de funil — encerra a run atual, preservando
    // seu histórico completo, e abre uma run nova no funil de destino ---
    const [{ data: oldPipeline }, { data: newPipeline }] = await Promise.all([
      supabase.from('pipelines').select('name').eq('id', run.pipeline_id).single(),
      supabase.from('pipelines').select('name').eq('id', newStage.pipeline_id).single(),
    ])

    await supabase
      .from('pipeline_runs')
      .update({ status: 'moved', ended_at: now })
      .eq('id', run.id)

    const { data: newRun, error: newRunError } = await supabase
      .from('pipeline_runs')
      .insert({
        contract_id: contractId,
        pipeline_id: newStage.pipeline_id,
        stage_id: newStage.id,
        stage_entered_at: now,
        value: run.value,                 // herda o valor da run anterior; ajuste manualmente se fizer sentido
        previous_run_id: run.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (newRunError || !newRun) return { error: 'Falha ao criar a nova passagem de funil.' }

    activeRunId = newRun.id

    await supabase.from('stage_history').insert({
      pipeline_run_id: newRun.id,
      stage_id: newStage.id,
      entered_at: now,
      changed_by: user.id,
    })

    await supabase.from('activities').insert({
      contract_id: contractId,
      pipeline_run_id: newRun.id,
      user_id: user.id,
      type: 'pipeline_change',
      content: `Movido do funil "${oldPipeline?.name}" para "${newPipeline?.name}", etapa "${newStage.name}". Histórico do funil anterior foi preservado.`,
      metadata: { from_run: run.id, to_run: newRun.id, from_pipeline: run.pipeline_id, to_pipeline: newStage.pipeline_id },
    })
  }

  // Verifica automação vinculada à nova etapa
  const { data: rule } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('trigger_stage_id', newStage.id)
    .eq('is_active', true)
    .maybeSingle()

  if (rule) {
    if ((rule.action_type === 'move_to_stage' || rule.action_type === 'move_to_pipeline') && rule.target_stage_id) {
      await supabase.from('activities').insert({
        contract_id: contractId,
        pipeline_run_id: activeRunId,
        type: 'automation_triggered',
        content: `Automação "${rule.name}" disparada.`,
        metadata: { rule_id: rule.id },
      })
      await moveContractStage(contractId, rule.target_stage_id, _depth + 1)
    } else if (rule.action_type === 'create_task' && rule.task_content) {
      await supabase.from('activities').insert({
        contract_id: contractId,
        pipeline_run_id: activeRunId,
        type: 'task',
        content: rule.task_content,
      })
    }
  }

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  return { success: true }
}

// Fecha o desfecho (Renovado/Não renovado, ou Ganho/Perdido, conforme os
// rótulos configurados no pipeline) SEM mudar a etapa atual do contrato.
// Isso é o que permite marcar "Renovado" com o contrato ainda em
// "Gestão de Contratos" — a etapa do processo e o desfecho final são
// duas coisas independentes agora, não uma etapa fixa no funil.
export async function closeRun(contractId: string, outcome: 'won' | 'lost'): Promise<MoveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const { data: run } = await supabase
    .from('pipeline_runs')
    .select('id, stage_id, pipeline_id')
    .eq('contract_id', contractId)
    .eq('status', 'open')
    .maybeSingle()

  if (!run) return { error: 'Nenhuma passagem de funil aberta para este contrato.' }

  if (outcome === 'won') {
    const { data: currentStage } = await supabase
      .from('stages')
      .select('is_won')
      .eq('id', run.stage_id)
      .maybeSingle()

    if (!currentStage?.is_won) {
      return { error: 'A etapa atual não está habilitada para marcar sucesso. Ative "Ganho" nessa etapa em Funis e Etapas, ou mova o contrato para uma etapa habilitada.' }
    }
  }

  const now = new Date().toISOString()

  // Fecha o registro de tempo-na-etapa aberto (mesma lógica de quando
  // muda de etapa — o relógio para de contar quando o desfecho fecha).
  const { data: openHistory } = await supabase
    .from('stage_history')
    .select('id, entered_at')
    .eq('pipeline_run_id', run.id)
    .is('exited_at', null)
    .maybeSingle()

  if (openHistory) {
    const enteredAtMs = new Date(openHistory.entered_at).getTime()
    const durationSeconds = Math.round((Date.now() - enteredAtMs) / 1000)
    await supabase
      .from('stage_history')
      .update({ exited_at: now, duration_seconds: durationSeconds })
      .eq('id', openHistory.id)
  }

  await supabase
    .from('pipeline_runs')
    .update({ status: outcome, ended_at: now })
    .eq('id', run.id)

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('won_label, lost_label, won_target_pipeline_id')
    .eq('id', run.pipeline_id)
    .single()

  const label = outcome === 'won' ? pipeline?.won_label ?? 'Ganho' : pipeline?.lost_label ?? 'Perdido'

  await supabase.from('activities').insert({
    contract_id: contractId,
    pipeline_run_id: run.id,
    user_id: user.id,
    type: 'stage_change',
    content: `Marcado como "${label}".`,
    metadata: { outcome, stage_id: run.stage_id },
  })

  // TRANSIÇÃO AUTOMÁTICA: se este pipeline tem um "funil de destino"
  // configurado para quando fecha como Ganho, cria automaticamente uma
  // nova passagem lá, na primeira etapa — preservando esta run antiga
  // como histórico (ela continua existindo, só que encerrada). É assim
  // que "Novos Negócios" pode alimentar "Contratos" sem trabalho manual.
  if (outcome === 'won' && pipeline?.won_target_pipeline_id) {
    const { data: targetPipeline } = await supabase
      .from('pipelines')
      .select('name')
      .eq('id', pipeline.won_target_pipeline_id)
      .single()

    const { data: firstStage } = await supabase
      .from('stages')
      .select('id, name')
      .eq('pipeline_id', pipeline.won_target_pipeline_id)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstStage) {
      const { data: newRun } = await supabase
        .from('pipeline_runs')
        .insert({
          contract_id: contractId,
          pipeline_id: pipeline.won_target_pipeline_id,
          stage_id: firstStage.id,
          stage_entered_at: now,
          previous_run_id: run.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (newRun) {
        await supabase.from('stage_history').insert({
          pipeline_run_id: newRun.id,
          stage_id: firstStage.id,
          entered_at: now,
          changed_by: user.id,
        })

        await supabase.from('activities').insert({
          contract_id: contractId,
          pipeline_run_id: newRun.id,
          user_id: user.id,
          type: 'pipeline_change',
          content: `Movido automaticamente para "${targetPipeline?.name}", etapa "${firstStage.name}", após marcar "${label}" em outro funil.`,
          metadata: { from_run: run.id, to_run: newRun.id },
        })
      }
    }
  }

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  return { success: true }
}
// voltando ela para status 'open' na mesma etapa em que estava. Isso
// NÃO apaga o histórico de quando ela foi encerrada — fica registrado
// na timeline como um evento novo ("Reaberto"), então o rastro de
// auditoria continua completo.
//
// LIMITAÇÃO CONHECIDA: só reabre se não existir NENHUMA outra run
// aberta para esse contrato (regra "um pipeline ativo por vez" que
// definimos desde o início) — se você já iniciou uma nova rodada de
// renovação depois de fechar essa, reabrir a antiga criaria duas runs
// abertas ao mesmo tempo, o que o banco bloqueia (índice único).
export async function reopenRun(contractId: string): Promise<MoveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const { data: existingOpenRun } = await supabase
    .from('pipeline_runs')
    .select('id')
    .eq('contract_id', contractId)
    .eq('status', 'open')
    .maybeSingle()

  if (existingOpenRun) {
    return { error: 'Este contrato já tem uma passagem de funil aberta. Não é possível reabrir outra.' }
  }

  const { data: lastRun } = await supabase
    .from('pipeline_runs')
    .select('id, stage_id, status')
    .eq('contract_id', contractId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastRun) return { error: 'Nenhuma passagem de funil encontrada para este contrato.' }
  if (lastRun.status === 'open') return { error: 'Esta passagem já está aberta.' }
  if (lastRun.status === 'moved') {
    return { error: 'Esta passagem foi movida para outro funil e não pode ser reaberta aqui — reabra a run no funil de destino, se necessário.' }
  }

  const now = new Date().toISOString()

  await supabase
    .from('pipeline_runs')
    .update({ status: 'open', ended_at: null })
    .eq('id', lastRun.id)

  // Reabre também o registro de tempo-na-etapa mais recente, para o
  // cálculo de "dias na etapa" continuar contando a partir de agora
  // em vez de ficar com um buraco no meio do histórico.
  const { data: lastHistory } = await supabase
    .from('stage_history')
    .select('id')
    .eq('pipeline_run_id', lastRun.id)
    .order('entered_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastHistory) {
    await supabase
      .from('stage_history')
      .update({ exited_at: null, duration_seconds: null })
      .eq('id', lastHistory.id)
  }

  await supabase.from('activities').insert({
    contract_id: contractId,
    pipeline_run_id: lastRun.id,
    user_id: user.id,
    type: 'system',
    content: 'Passagem de funil reaberta.',
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  revalidatePath('/contracts')
  return { success: true }
}
