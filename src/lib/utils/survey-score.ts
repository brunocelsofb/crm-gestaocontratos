import type { Question } from '@/lib/actions/custom-surveys'

// Pontuação de UMA resposta: média das perguntas do tipo "rating"
// (0 a 10) que ela contém. Perguntas de texto/escolha não entram na
// conta — só fazem sentido pra leitura qualitativa, não pra pontuação.
// Se o formulário não tiver nenhuma pergunta de nota, retorna null (não
// existe "pontuação" pra ele, e isso precisa ficar visualmente claro,
// não virar um 0 enganoso).
export function calculateResponseScore(
  questions: Question[],
  responses: Record<string, string | string[]> | null
): number | null {
  if (!responses) return null

  const ratingValues = questions
    .filter((q) => q.type === 'rating')
    .map((q) => responses[q.id])
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .map(Number)
    .filter((n) => !Number.isNaN(n))

  if (ratingValues.length === 0) return null

  return Math.round((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length) * 10) / 10
}

// Pontuação AGREGADA de várias respostas (ex: todas as respostas de um
// formulário num período) — média simples das pontuações individuais.
export function calculateAverageScore(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}
