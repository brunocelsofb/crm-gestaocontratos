'use client'

import { useState, useTransition } from 'react'
import { moveContractStage, reopenRun, closeRun } from '@/lib/actions/pipeline'
import { addMonthsToDateString } from '@/lib/utils/date'

type Stage = {
  id: string; name: string; order_index: number
  is_won: boolean; is_lost: boolean; sla_days: number | null; color: string | null
}
type StageTiming = { stageId: string; days: number | null; isOverdue: boolean }

const MONTH_SHORTCUTS = [1, 2, 3, 6, 12, 24, 36, 48, 60]
const CNPJS_ORBIS = [
  { value: '23129279000103', label: '23.129.279/0001-03' },
  { value: '23129279000194', label: '23.129.279/0001-94' },
]
const CONTRACT_TYPES = [
  { value: 'fixo', label: 'Fixo' },
  { value: 'medicao', label: 'Por Medição' },
]

export function StageBar({
  contractId, stages, currentStageId, timings, status,
  wonLabel, lostLabel, canChangeStage, pipelineType,
  contractNature, contractValue,
}: {
  contractId: string; stages: Stage[]; currentStageId: string
  timings: StageTiming[]; status: string; wonLabel: string; lostLabel: string
  canChangeStage: boolean; pipelineType?: string
  contractNature?: string | null
  contractValue?: number
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showWonModal, setShowWonModal] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [cnpjBilling, setCnpjBilling] = useState(CNPJS_ORBIS[0].value)
  const [contractType, setContractType] = useState('')
  const [monthlyValue, setMonthlyValue] = useState(contractValue ? String(contractValue) : '')

  const currentIndex = stages.findIndex((s) => s.id === currentStageId)
  const currentStage = stages[currentIndex]
  const canMarkWon  = currentStage?.is_won === true
  const canMarkLost = currentStage?.is_lost === true
  const isGestaoContratos = pipelineType === 'gestao_contratos'
  const isVendas = pipelineType === 'vendas'

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#f8f9fb', color: '#1a1f36', outline: 'none' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }
  const modalValid = !!validFrom && !!validUntil && (isGestaoContratos || !!contractType)

  function timingFor(stageId: string) { return timings.find((t) => t.stageId === stageId) }

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

  function handleWonClick() { setShowWonModal(true) }

  function handleClose(outcome: 'won' | 'lost', extraData?: {
    validFrom?: string; validUntil?: string
    cnpjBilling?: string; contractType?: string; monthlyValue?: string
  }) {
    setError(null)
    startTransition(async () => {
      if (extraData && (extraData.validFrom || extraData.validUntil || extraData.cnpjBilling)) {
        try {
          const patch: Record<string, any> = {}
          if (extraData.validFrom)    patch.valid_from    = extraData.validFrom
          if (extraData.validUntil)   patch.valid_until   = extraData.validUntil
          if (extraData.cnpjBilling)  patch.cnpj_billing  = extraData.cnpjBilling
          if (extraData.contractType) patch.contract_type = extraData.contractType
          if (extraData.monthlyValue) patch.monthly_value = Number(extraData.monthlyValue)
          const res = await fetch(`/api/carteira/${contractId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
          if (!res.ok) {
            const json = await res.json().catch(() => ({}))
            setError(json.error ?? 'Erro ao salvar dados.')
            return
          }
        } catch { setError('Erro de conexão.'); return }
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
      <div className="flex gap-1 overflow-x-auto">
        {stages.map((stage, i) => {
          const timing = timingFor(stage.id)
          const isCurrent = stage.id === currentStageId
          const isFuture  = i > currentIndex
          const color = stage.color ?? '#1B556B'
          return (
            <button key={stage.id}
              disabled={isPending || isCurrent || status !== 'open' || !canChangeStage}
              onClick={() => handleMove(stage.id)}
              title={!canChangeStage ? 'Só o dono da conta (ou admin) pode mudar a etapa' : status !== 'open' ? 'Este contrato já está encerrado' : `Mover para "${stage.name}"`}
              style={{ backgroundColor: color }}
              className="flex min-w-[130px] flex-1 flex-col items-center justify-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-white opacity-90 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-90"
            >
              <span className="text-center leading-tight">{stage.name}</span>
              {timing?.days !== null && timing?.days !== undefined && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${timing.isOverdue ? 'bg-negative-700/80' : 'bg-black/15'}`}>
                  {timing.days === 0 ? 'Menos de 1 dia' : `${timing.days} dias`}
                </span>
              )}
              {isFuture && <span className="text-[9px] text-white/70">ainda não visitada</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Modal ao dar ganho */}
      {showWonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1a1f36', marginBottom: 4 }}>
              {isGestaoContratos ? 'Confirmar Renovação' : `Confirmar ${wonLabel}`}
            </h2>
            <p style={{ fontSize: 12, color: '#8892a4', marginBottom: 20 }}>
              {isGestaoContratos ? 'Preencha a nova vigência antes de confirmar.' : 'Preencha os dados obrigatórios para transferir ao funil de contratos.'}
            </p>

            <p style={{ fontSize: 10, fontWeight: 600, color: '#1a1f36', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>Vigência</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
              <div><label style={lbl}>Início <span style={{ color: '#b91c1c' }}>*</span></label>
                <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Fim <span style={{ color: '#b91c1c' }}>*</span></label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inp} /></div>
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

            {isVendas && (
              <>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#1a1f36', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10, paddingTop: 8, borderTop: '0.5px solid #f1f3f8' }}>Dados do contrato</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={lbl}>CNPJ de Faturamento (ORBIS) <span style={{ color: '#b91c1c' }}>*</span></label>
                    <select value={cnpjBilling} onChange={e => setCnpjBilling(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      {CNPJS_ORBIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Tipo de contrato <span style={{ color: '#b91c1c' }}>*</span></label>
                      <select value={contractType} onChange={e => setContractType(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="">Selecione...</option>
                        {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Valor mensal (R$)</label>
                      <input type="number" value={monthlyValue} onChange={e => setMonthlyValue(e.target.value)} style={inp} />
                    </div>
                  </div>
                  {contractNature && (
                    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#eef3ff', fontSize: 11, color: '#3b5bdb' }}>
                      📋 Natureza: <strong>{contractNature === 'eng_clinica' ? 'Engenharia Clínica' : 'Engenharia Hospitalar'}</strong> — pré-preenchida pela tag
                    </div>
                  )}
                </div>
              </>
            )}

            {!modalValid && <p style={{ fontSize: 11, color: '#92400e', marginBottom: 12 }}>
              ⚠ {!validFrom || !validUntil ? 'Preencha início e fim da vigência.' : 'Selecione o tipo de contrato.'}
            </p>}
            {error && <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowWonModal(false)}
                style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button disabled={isPending || !modalValid}
                onClick={() => handleClose('won', { validFrom, validUntil, cnpjBilling, contractType, monthlyValue })}
                style={{ padding: '8px 20px', fontSize: 12, fontWeight: 500, borderRadius: 8, border: 'none', background: !modalValid ? '#d1d8e8' : '#1a7c3e', color: '#fff', cursor: !modalValid ? 'not-allowed' : 'pointer' }}>
                {isPending ? 'Salvando...' : `Confirmar ${wonLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Etapa atual: <span className="font-medium text-gray-900">{stages[currentIndex]?.name ?? '—'}</span>
        </p>
        {status === 'open' && (
          <div className="flex gap-2">
            <button onClick={handleWonClick} disabled={isPending || !canMarkWon}
              title={canMarkWon ? undefined : `Só é possível marcar "${wonLabel}" numa etapa habilitada`}
              className="rounded-md bg-positive-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-positive-700 disabled:cursor-not-allowed disabled:opacity-40">
              {wonLabel}
            </button>
            <button onClick={() => handleClose('lost')} disabled={isPending || !canMarkLost}
              title={canMarkLost ? undefined : `Só é possível marcar "${lostLabel}" numa etapa habilitada`}
              className="rounded-md bg-negative-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-negative-700 disabled:cursor-not-allowed disabled:opacity-40">
              {lostLabel}
            </button>
          </div>
        )}
        {status !== 'open' && (
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${status === 'won' ? 'text-positive-700' : 'text-negative-700'}`}>
              {status === 'won' ? wonLabel : lostLabel}
            </span>
            <button onClick={handleReopen} disabled={isPending}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {isPending ? 'Reabrindo...' : 'Reabrir'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
