'use client'

import { useState, useTransition } from 'react'
import { moveContractStage, reopenRun, closeRun } from '@/lib/actions/pipeline'
import { addMonthsToDateString } from '@/lib/utils/date'

type Stage = {
  id: string
  name: string
  order_index: number
  is_won: boolean
  is_lost: boolean
  sla_days: number | null
  color: string | null
}

type StageTiming = {
  stageId: string
  days: number | null
  isOverdue: boolean
}

const MONTH_SHORTCUTS = [1, 2, 3, 6, 12, 24, 36, 48, 60]

export function StageBar({
  contractId,
  stages,
  currentStageId,
  timings,
  status,
  wonLabel,
  lostLabel,
  canChangeStage,
  pipelineType,
}: {
  contractId: string
  stages: Stage[]
  currentStageId: string
  timings: StageTiming[]
  status: string
  wonLabel: string
  lostLabel: string
  canChangeStage: boolean
  pipelineType?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showWonModal, setShowWonModal] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')

  const currentIndex = stages.findIndex((s) => s.id === currentStageId)
  const currentStage = stages[currentIndex]
  const canMarkWon = currentStage?.is_won === true
  const canMarkLost = currentStage?.is_lost === true
  const isGestaoContratos = pipelineType === 'gestao_contratos'

  function timingFor(stageId: string) {
    return timings.find((t) => t.stageId === stageId)
  }

  function handleMove(stageId: string) {
    setError(null)
    startTransition(async () => {
      const result = await moveContractStage(contractId, stageId)
      if (result.error) setError(result.error)
    })
  }

  function handleReopen() {
    setError(null)
    startTransition(async () => {
      const result = await reopenRun(contractId)
      if (result.error) setError(result.error)
    })
  }

  function handleWonClick() {
    // Para Gestão de Contratos: exige vigência antes de fechar
    if (isGestaoContratos) {
      setShowWonModal(true)
      return
    }
    handleClose('won')
  }

  function handleClose(outcome: 'won' | 'lost', extraData?: { validFrom?: string; validUntil?: string }) {
    setError(null)
    startTransition(async () => {
      // Salva vigência antes de fechar, se fornecida
      if (extraData?.validFrom || extraData?.validUntil) {
        try {
          const res = await fetch(`/api/carteira/${contractId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              valid_from: extraData.validFrom || null,
              valid_until: extraData.validUntil || null,
            }),
          })
          if (!res.ok) {
            const json = await res.json().catch(() => ({}))
            setError(json.error ?? 'Erro ao salvar vigência.')
            return
          }
        } catch {
          setError('Erro de conexão ao salvar vigência.')
          return
        }
      }
      const result = await closeRun(contractId, outcome)
      if (result.error) setError(result.error)
      else setShowWonModal(false)
    })
  }

  return (
    <div className="space-y-3">
      {!canChangeStage && (
        <p className="rounded-md bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800">
          Só o dono da conta (ou um admin) pode mudar a etapa.
        </p>
      )}
      {/* Etapa do processo — livre para mover pra frente ou pra trás,
          independente do desfecho (Renovado/Não renovado) */}
      <div className="flex gap-1 overflow-x-auto">
        {stages.map((stage, i) => {
          const timing = timingFor(stage.id)
          const isCurrent = stage.id === currentStageId
          const isFuture = i > currentIndex
          const color = stage.color ?? '#1B556B'

          return (
            <button
              key={stage.id}
              disabled={isPending || isCurrent || status !== 'open' || !canChangeStage}
              onClick={() => handleMove(stage.id)}
              title={
                !canChangeStage
                  ? 'Só o dono da conta (ou admin) pode mudar a etapa'
                  : status !== 'open'
                    ? 'Este contrato já está encerrado'
                    : `Mover para "${stage.name}"`
              }
              style={{ backgroundColor: color }}
              className="flex min-w-[130px] flex-1 flex-col items-center justify-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-white opacity-90 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-90"
            >
              <span className="text-center leading-tight">{stage.name}</span>
              {timing?.days !== null && timing?.days !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    timing.isOverdue ? 'bg-negative-700/80' : 'bg-black/15'
                  }`}
                >
                  {timing.days === 0 ? 'Menos de 1 dia' : `${timing.days} dias`}
                </span>
              )}
              {isFuture && <span className="text-[9px] text-white/70">ainda não visitada</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Modal de vigência obrigatória — só aparece em Gestão de Contratos */}
      {showWonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '0.5px solid #e8edf5' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1a1f36', marginBottom: 4 }}>Confirmar Renovação</h2>
            <p style={{ fontSize: 12, color: '#8892a4', marginBottom: 16 }}>
              Preencha a nova vigência antes de confirmar. O fim é calculado a partir do início.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: '#8892a4', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 4 }}>
                  Início da vigência <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: '#8892a4', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 4 }}>
                  Fim da vigência <span style={{ color: '#b91c1c' }}>*</span>
                </label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
              {MONTH_SHORTCUTS.map(m => (
                <button key={m} type="button" disabled={!validFrom}
                  onClick={() => validFrom && setValidUntil(addMonthsToDateString(validFrom, m))}
                  style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, border: '0.5px solid #d1d8e8', background: '#fff', color: validFrom ? '#1a1f36' : '#b0b8c8', cursor: validFrom ? 'pointer' : 'not-allowed', opacity: validFrom ? 1 : 0.5 }}>
                  +{m}m
                </button>
              ))}
            </div>

            {!validFrom || !validUntil ? (
              <p style={{ fontSize: 11, color: '#f59e0b', marginBottom: 12 }}>⚠ Preencha início e fim da vigência para continuar.</p>
            ) : null}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowWonModal(false)} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                disabled={isPending || !validFrom || !validUntil}
                onClick={() => handleClose('won', { validFrom, validUntil })}
                style={{ padding: '8px 16px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: !validFrom || !validUntil ? '#d1d8e8' : '#1a7c3e', color: '#fff', cursor: !validFrom || !validUntil ? 'not-allowed' : 'pointer' }}>
                {isPending ? 'Salvando...' : `Confirmar ${wonLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desfecho */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Etapa atual: <span className="font-medium text-gray-900">{stages[currentIndex]?.name ?? '—'}</span>
        </p>
        {status === 'open' && (
          <div className="flex gap-2">
            <button
              onClick={handleWonClick}
              disabled={isPending || !canMarkWon}
              title={canMarkWon ? undefined : `Só é possível marcar "${wonLabel}" quando o contrato está numa etapa habilitada para isso`}
              className="rounded-md bg-positive-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-positive-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {wonLabel}
            </button>
            <button
              onClick={() => handleClose('lost')}
              disabled={isPending || !canMarkLost}
              title={canMarkLost ? undefined : `Só é possível marcar "${lostLabel}" quando o contrato está numa etapa habilitada para isso`}
              className="rounded-md bg-negative-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-negative-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {lostLabel}
            </button>
          </div>
        )}
        {status !== 'open' && (
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${status === 'won' ? 'text-positive-700' : 'text-negative-700'}`}>
              {status === 'won' ? wonLabel : lostLabel}
            </span>
            <button
              onClick={handleReopen}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isPending ? 'Reabrindo...' : 'Reabrir'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
