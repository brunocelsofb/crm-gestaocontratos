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
import { createAdminClient } from '@/lib/supabase/admin'

export type MoveResult = { success?: true; error?: string }

// Verifica todos os funis com automação de renovação configurada e move
// automaticamente os contratos que entraram no prazo (ex: 60 dias antes
// do vencimento) pra etapa de renovação designada. Roda sem checar
// permissão de "dono da conta" — é o sistema movendo, não uma pessoa.
//
// NOTA DE INCERTEZA: hoje isso só é verificado quando alguém abre a
// tela do Funil (chamado a partir de lá) — não é um agendamento de
// verdade rodando sozinho em segundo plano o tempo todo. Se ninguém
// abrir o CRM por vários dias, a automação só vai "pegar o atraso"
// na próxima vez que alguém entrar. Um cron de verdade (rodando
// mesmo sem ninguém usando o sistema) é possível de configurar depois
// na Vercel, se for necessário.
export async function checkAndTriggerRenewals() {
  const supabase = createAdminClient()

  const { data: pipelinesWithRenewal } = await supabase
    .from('pipelines')
    .select('id, renewal_trigger_days, renewal_target_stage_id')
    .not('renewal_trigger_days', 'is', null)
    .not('renewal_target_stage_id', 'is', null)

  if (!pipelinesWithRenewal || pipelinesWithRenewal.length === 0) return

  for (const pipeline of pipelinesWithRenewal) {
    const { data: openRuns } = await supabase
      .from('pipeline_runs')
      .select('id, contract_id, stage_id')
      .eq('pipeline_id', pipeline.id)
      .eq('status', 'open')
      .neq('stage_id', pipeline.renewal_target_stage_id as string)

    if (!openRuns || openRuns.length === 0) continue

    const contractIds = openRuns.map((r) => r.contract_id)
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, valid_until')
      .in('id', contractIds)
      .not('valid_until', 'is', null)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const contract of contracts ?? []) {
      const validUntil = new Date(contract.valid_until as string)
      const daysUntilExpiry = Math.floor((validUntil.getTime() - today.getTime()) / 86_400_000)

      if (daysUntilExpiry <= (pipeline.renewal_trigger_days as number)) {
        const run = openRuns.find((r) => r.contract_id === contract.id)
        if (!run) continue

        const now = new Date().toISOString()

        const { data: openHistory } = await supabase
          .from('stage_history')
          .select('id, entered_at')
          .eq('pipeline_run_id', run.id)
          .is('exited_at', null)
          .maybeSingle()

        if (openHistory) {
          const durationSeconds = Math.round((Date.now() - new Date(openHistory.entered_at).getTime()) / 1000)
          await supabase.from('stage_history').update({ exited_at: now, duration_seconds: durationSeconds }).eq('id', openHistory.id)
        }

        await supabase
          .from('pipeline_runs')
          .update({ stage_id: pipeline.renewal_target_stage_id, stage_entered_at: now })
          .eq('id', run.id)

        await supabase.from('stage_history').insert({
          pipeline_run_id: run.id,
          stage_id: pipeline.renewal_target_stage_id,
          entered_at: now,
        })

        await supabase.from('activities').insert({
          contract_id: contract.id,
          pipeline_run_id: run.id,
          type: 'automation_triggered',
          content: `Movido automaticamente para renovação — contrato vence em ${daysUntilExpiry} dia(s) (limite configurado: ${pipeline.renewal_trigger_days} dias).`,
        })
      }
    }
  }
}

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

  // Só o DONO DA CONTA (fixo, tipo Customer Success — owner_id) ou um
  // admin pode mudar a etapa. Isso é diferente de current_assignee_id,
  // que é só quem está tratando algo pontual no momento e não deveria
  // controlar o funil.
  if (_depth === 0) {
    const [{ data: contractForPermCheck }, { data: profile }] = await Promise.all([
      supabase.from('contracts').select('owner_id').eq('id', contractId).maybeSingle(),
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
    ])

    const isOwner = contractForPermCheck?.owner_id === user.id
    const isAdmin = profile?.role === 'admin'

    if (!isOwner && !isAdmin) {
      return { error: 'Só o dono da conta (ou um admin) pode mudar a etapa.' }
    }
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

    // TRAVA ESPECÍFICA DO FUNIL DE VENDAS: só pode marcar Ganho depois
    // que o time técnico deu ciência do dimensionamento (status
    // 'acknowledged_ok'). Isso NÃO se aplica a outros tipos de funil
    // (Gestão de Contratos, Serviço Avulso), só a Vendas.
    const { data: pipelineForGate } = await supabase
      .from('pipelines')
      .select('type')
      .eq('id', run.pipeline_id)
      .single()

    if (pipelineForGate?.type === 'vendas') {
      const { data: latestReview } = await supabase
        .from('dimensioning_reviews')
        .select('status')
        .eq('contract_id', contractId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestReview || latestReview.status !== 'acknowledged_ok') {
        return {
          error: 'O time técnico ainda não deu ciência do dimensionamento. Envie o dimensionamento para aprovação antes de marcar Ganho.',
        }
      }
    }

    // TRAVA ESPECÍFICA DO FUNIL DE GESTÃO DE CONTRATOS: marcar sucesso
    // aqui normalmente significa "renovação concluída" — exige que a
    // vigência final seja uma data FUTURA (não só "preenchida", já que
    // uma vigência antiga/vencida também conta como "preenchida" e não
    // representa uma renovação de verdade).
    if (pipelineForGate?.type === 'gestao_contratos') {
      const { data: contractForValidity } = await supabase
        .from('contracts')
        .select('valid_until')
        .eq('id', contractId)
        .maybeSingle()

      const todayStr = new Date().toISOString().slice(0, 10)

      if (!contractForValidity?.valid_until) {
        return {
          error: 'Preencha a nova vigência (data final) do contrato antes de marcar sucesso — é ela que representa a renovação.',
        }
      }

      if (contractForValidity.valid_until <= todayStr) {
        return {
          error: `A vigência está com data vencida ou é hoje (${new Date(contractForValidity.valid_until).toLocaleDateString('pt-BR')}). Atualize pra uma data futura antes de marcar sucesso — isso é o que confirma que a renovação foi feita de verdade.`,
        }
      }
    }
  }

  if (outcome === 'lost') {
    const { data: currentStage } = await supabase
      .from('stages')
      .select('is_lost')
      .eq('id', run.stage_id)
      .maybeSingle()

    if (!currentStage?.is_lost) {
      return { error: 'A etapa atual não está habilitada para marcar perda. Ative "Perdido" nessa etapa em Funis e Etapas, ou mova o contrato para uma etapa habilitada.' }
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
    .select('won_label, lost_label, won_target_pipeline_id, won_target_stage_id')
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

    // Se uma etapa específica foi configurada ("won_target_stage_id"),
    // usa ela — importante pra renovação: não faz sentido voltar pra
    // "Implantação" de novo, e sim ir direto pra "Gestão de Contratos".
    // Sem configuração, cai no comportamento antigo (primeira etapa).
    let targetStage: { id: string; name: string } | null = null

    if (pipeline.won_target_stage_id) {
      const { data: chosenStage } = await supabase
        .from('stages')
        .select('id, name')
        .eq('id', pipeline.won_target_stage_id)
        .maybeSingle()
      targetStage = chosenStage
    }

    if (!targetStage) {
      const { data: firstStage } = await supabase
        .from('stages')
        .select('id, name')
        .eq('pipeline_id', pipeline.won_target_pipeline_id)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle()
      targetStage = firstStage
    }

    if (targetStage) {
      const { data: newRun } = await supabase
        .from('pipeline_runs')
        .insert({
          contract_id: contractId,
          pipeline_id: pipeline.won_target_pipeline_id,
          stage_id: targetStage.id,
          stage_entered_at: now,
          previous_run_id: run.id,
          created_by: user.id,
        })
        .select()
        .single()

      if (newRun) {
        await supabase.from('stage_history').insert({
          pipeline_run_id: newRun.id,
          stage_id: targetStage.id,
          entered_at: now,
          changed_by: user.id,
        })

        await supabase.from('activities').insert({
          contract_id: contractId,
          pipeline_run_id: newRun.id,
          user_id: user.id,
          type: 'pipeline_change',
          content: `Movido automaticamente para "${targetPipeline?.name}", etapa "${targetStage.name}", após marcar "${label}" em outro funil.`,
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
// Atualiza o VALOR do contrato pra esta passagem — separado de
// propósito do faturamento mensal (BillingSection). São coisas
// diferentes: isso aqui é o valor renegociado do contrato como um todo
// (geralmente com reajuste de IPCA ou similar), o faturamento é o que
// foi confirmado mês a mês pro financeiro. O faturamento NUNCA deve
// alimentar isso automaticamente.
export async function updateRunValue(contractId: string, newValue: number): Promise<MoveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado.' }

  const [{ data: contractForOwner }, { data: profile }] = await Promise.all([
    supabase.from('contracts').select('owner_id').eq('id', contractId).maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ])

  const isOwner = contractForOwner?.owner_id === user.id
  const isAdmin = profile?.role === 'admin'

  if (!isOwner && !isAdmin) {
    return { error: 'Só o dono da conta (ou um admin) pode definir o novo valor da renovação.' }
  }

  if (Number.isNaN(newValue) || newValue < 0) {
    return { error: 'Informe um valor válido.' }
  }

  const { data: run } = await supabase
    .from('pipeline_runs')
    .select('id, value')
    .eq('contract_id', contractId)
    .eq('status', 'open')
    .maybeSingle()

  if (!run) return { error: 'Nenhuma passagem de funil aberta para este contrato.' }

  const oldValue = Number(run.value) || 0
  const { error } = await supabase.from('pipeline_runs').update({ value: newValue }).eq('id', run.id)
  if (error) return { error: error.message }

  const pctChange = oldValue > 0 ? Math.round(((newValue - oldValue) / oldValue) * 1000) / 10 : null

  await supabase.from('activities').insert({
    contract_id: contractId,
    pipeline_run_id: run.id,
    user_id: user.id,
    type: 'system',
    content: `Valor do contrato atualizado de R$ ${oldValue.toLocaleString('pt-BR')} para R$ ${newValue.toLocaleString('pt-BR')}${pctChange !== null ? ` (${pctChange >= 0 ? '+' : ''}${pctChange}%)` : ''}.`,
  })

  revalidatePath(`/contracts/${contractId}`)
  revalidatePath('/pipeline')
  return { success: true }
}

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
