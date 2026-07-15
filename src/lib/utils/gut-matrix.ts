// Prioridade do atendimento — 4 níveis leves, sem "média", com os
// prazos reais de SLA que vocês usam. A Matriz GUT foi removida do
// módulo (fica só o prazo de resolução mesmo).

export type PriorityTier = 'nao_critica' | 'pouco_critica' | 'critica' | 'muito_critica'

export const PRIORITY_LABELS: Record<PriorityTier, string> = {
  nao_critica: 'Melhoria / Pode esperar',
  pouco_critica: 'Baixa',
  critica: 'Alta',
  muito_critica: 'Urgente',
}

// Prazo real de SLA de vocês (em dias).
export const PRIORITY_SLA_DAYS: Record<PriorityTier, number> = {
  nao_critica: 7,
  pouco_critica: 3,
  critica: 2,
  muito_critica: 1,
}

// Categorias do chamado — só pra classificar/filtrar, sem cálculo por
// trás.
export const GRAVITY_CATEGORIES: { value: string; label: string }[] = [
  { value: 'elogio_sugestao_duvida', label: 'Elogio, sugestão ou dúvida' },
  { value: 'reclamacao_qualidade', label: 'Reclamação sobre qualidade do serviço' },
  { value: 'erro_servico', label: 'Erro no serviço' },
  { value: 'atendimento_insatisfatorio', label: 'Atendimento insatisfatório' },
  { value: 'falha_recorrente', label: 'Reincidência de falha já reportada antes' },
  { value: 'nao_atendimento_contrato', label: 'Não atendimento ao contrato' },
  { value: 'atraso_entrega', label: 'Atraso na entrega do serviço' },
  { value: 'outro', label: 'Outro assunto (justificar na descrição)' },
]
