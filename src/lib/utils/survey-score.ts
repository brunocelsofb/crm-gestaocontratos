import type { Question } from '@/lib/actions/custom-surveys'

// Escala Likert de 5 pontos — método padrão da pesquisa de satisfação
// (diferente do NPS, que usa 0 a 10). Cada rótulo mapeia pra um ponto:
// Muito insatisfeito(1) → Muito insatisfeito(2) → Nem/nem(3) →
// Satisfeito(4) → Muito satisfeito(5).
export const LIKERT_OPTIONS = [
  { label: 'Muito insatisfeito', points: 1 },
  { label: 'Insatisfeito', points: 2 },
  { label: 'Nem satisfeito, nem insatisfeito', points: 3 },
  { label: 'Satisfeito', points: 4 },
  { label: 'Muito satisfeito', points: 5 },
] as const

const LIKERT_POINTS: Record<string, number> = Object.fromEntries(
  LIKERT_OPTIONS.map((o) => [o.label, o.points])
)

export type ScoreScale = 'likert' | 'rating'

export type ResponseScore = {
  value: number
  scale: ScoreScale
  max: number // 5 pra Likert, 10 pra rating — usado pra exibir "4,2 / 5" etc.
} | null

// Pontuação de UMA resposta. Prioriza perguntas do tipo Likert (o método
// correto pra pesquisa de satisfação); se não tiver nenhuma, cai pra
// perguntas do tipo "rating" (0 a 10, estilo NPS) como alternativa. As
// duas escalas NUNCA são misturadas na mesma média — teriam significados
// diferentes (1-5 não é comparável a 0-10 sem distorcer o número).
export function calculateResponseScore(
  questions: Question[],
  responses: Record<string, string | string[]> | null
): ResponseScore {
  if (!responses) return null

  const likertValues = questions
    .filter((q) => q.type === 'likert')
    .map((q) => responses[q.id])
    .filter((v): v is string => typeof v === 'string' && v in LIKERT_POINTS)
    .map((v) => LIKERT_POINTS[v])

  if (likertValues.length > 0) {
    const avg = likertValues.reduce((a, b) => a + b, 0) / likertValues.length
    return { value: Math.round(avg * 10) / 10, scale: 'likert', max: 5 }
  }

  const ratingValues = questions
    .filter((q) => q.type === 'rating')
    .map((q) => responses[q.id])
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .map(Number)
    .filter((n) => !Number.isNaN(n))

  if (ratingValues.length === 0) return null

  const avg = ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
  return { value: Math.round(avg * 10) / 10, scale: 'rating', max: 10 }
}

// Pontuação AGREGADA de várias respostas (ex: todas as respostas de um
// formulário num período) — média simples das pontuações individuais,
// já assumindo que todas usam a MESMA escala (o próprio
// calculateResponseScore garante isso, escolhendo uma escala por resposta).
export function calculateAverageScore(scores: ResponseScore[]): { value: number; max: number } | null {
  const valid = scores.filter((s): s is NonNullable<ResponseScore> => s !== null)
  if (valid.length === 0) return null
  const max = valid[0].max
  const avg = valid.reduce((sum, s) => sum + s.value, 0) / valid.length
  return { value: Math.round(avg * 10) / 10, max }
}
