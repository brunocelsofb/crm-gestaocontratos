// Reconciliação com a Matriz GUT (Anexo I e II do documento de
// atendimento de vocês) — a pessoa que abre o chamado só vê uma
// linguagem leve ("Pode esperar", "Urgente"), mas por trás o sistema
// guarda a classificação completa (Gravidade × Urgência × Tendência) e
// mostra a criticidade de verdade pra equipe.

export type PriorityTier = 'nao_critica' | 'pouco_critica' | 'critica' | 'muito_critica'

// Rótulo leve (o que a pessoa vê) — sem "média", como pedido.
export const PRIORITY_LABELS: Record<PriorityTier, string> = {
  nao_critica: 'Melhoria / Pode esperar',
  pouco_critica: 'Baixa',
  critica: 'Alta',
  muito_critica: 'Urgente',
}

// Prazo real de SLA de vocês (em dias) — não é hora, é dia mesmo.
export const PRIORITY_SLA_DAYS: Record<PriorityTier, number> = {
  nao_critica: 7,
  pouco_critica: 3,
  critica: 2,
  muito_critica: 1,
}

// Nome técnico (Matriz GUT / criticidade) — mostrado só na área
// interna, nunca no formulário público.
export const PRIORITY_CRITICALITY_LABELS: Record<PriorityTier, string> = {
  nao_critica: 'Não crítica',
  pouco_critica: 'Pouco crítica',
  critica: 'Crítica',
  muito_critica: 'Muito crítica',
}

// Urgência (U) da Matriz GUT — derivada do nível escolhido. Pula o "3"
// (o equivalente a "média"), porque não usamos essa categoria.
export const PRIORITY_TO_URGENCY: Record<PriorityTier, number> = {
  nao_critica: 1,
  pouco_critica: 2,
  critica: 4,
  muito_critica: 5,
}

// Gravidade (G) — Anexo I: classificação da natureza da manifestação.
// A pessoa escolhe a categoria que melhor descreve o problema (em
// linguagem simples), o sistema já sabe a gravidade correspondente.
export const GRAVITY_CATEGORIES: { value: string; label: string; gravity: number }[] = [
  { value: 'elogio_sugestao_duvida', label: 'Elogio, sugestão ou dúvida', gravity: 1 },
  { value: 'atraso_pequeno', label: 'Pequeno atraso, sem impacto na entrega', gravity: 2 },
  { value: 'reclamacao_simples', label: 'Reclamação simples sobre qualidade do serviço', gravity: 2 },
  { value: 'erro_servico', label: 'Erro no serviço', gravity: 3 },
  { value: 'atendimento_insatisfatorio', label: 'Atendimento insatisfatório', gravity: 3 },
  { value: 'falha_recorrente', label: 'Reincidência de falha já reportada antes', gravity: 3 },
  { value: 'conduta_inadequada', label: 'Conduta inadequada de colaborador, com prejuízo', gravity: 4 },
  { value: 'dano_patrimonial', label: 'Dano patrimonial (moderado a grave)', gravity: 4 },
  { value: 'ameaca_seguranca', label: 'Ameaça à segurança do cliente ou colaborador', gravity: 5 },
  { value: 'risco_reputacao', label: 'Risco à reputação da empresa', gravity: 5 },
  { value: 'ato_ilicito_paralisacao', label: 'Ato ilícito ou falha que paralisa o serviço', gravity: 5 },
]

export function gravityForCategory(category: string | null): number | null {
  return GRAVITY_CATEGORIES.find((c) => c.value === category)?.gravity ?? null
}

// Índice GUT (G × U × T) — só pra priorizar DENTRO de um mesmo nível de
// criticidade, não substitui o prazo de SLA (esse continua fixo por
// nível, como vocês já usam).
export function calculateGutIndex(gravity: number | null, urgency: number, trend: number | null): number | null {
  if (!gravity || !trend) return null
  return gravity * urgency * (trend ?? 3)
}
