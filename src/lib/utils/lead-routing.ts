export type RoutingCondition = {
  field: 'source' | 'score' | 'sector' | 'message_length' | 'has_phone' | 'has_company'
  operator: 'equals' | 'not_equals' | 'gte' | 'lte' | 'contains' | 'is_true'
  value: string
}

export type RoutingRule = {
  id: string
  name: string
  priority: number
  is_active: boolean
  conditions: RoutingCondition[]
  conditions_logic: 'AND' | 'OR'
  target_pipeline_id: string | null
  target_stage_id: string | null
  responsible_type: 'none' | 'fixed' | 'round_robin'
  responsible_user_id: string | null
}

type LeadData = {
  source: string | null
  score: number
  company_name: string | null
  message: string | null
  phone: string | null
}

function evaluateCondition(cond: RoutingCondition, lead: LeadData): boolean {
  const val = cond.value

  switch (cond.field) {
    case 'source':
      if (cond.operator === 'equals')     return lead.source === val
      if (cond.operator === 'not_equals') return lead.source !== val
      return false
    case 'score': {
      const n = Number(val)
      if (cond.operator === 'gte') return lead.score >= n
      if (cond.operator === 'lte') return lead.score <= n
      return false
    }
    case 'message_length': {
      const len = lead.message?.length ?? 0
      if (cond.operator === 'gte') return len >= Number(val)
      if (cond.operator === 'lte') return len <= Number(val)
      return false
    }
    case 'has_phone':   return cond.operator === 'is_true' ? !!lead.phone : !lead.phone
    case 'has_company': return cond.operator === 'is_true' ? !!lead.company_name : !lead.company_name
    case 'sector':
      if (cond.operator === 'equals') {
        const HEALTH_KW = ['hospital','clinica','clínica','saude','saúde','medic','health','laborator']
        const isHealth = HEALTH_KW.some(kw => (lead.company_name ?? '').toLowerCase().includes(kw))
        return val === 'health' ? isHealth : !isHealth
      }
      return false
    default: return false
  }
}

export function matchRoutingRule(rules: RoutingRule[], lead: LeadData): RoutingRule | null {
  const active = rules.filter(r => r.is_active).sort((a, b) => a.priority - b.priority)

  for (const rule of active) {
    if (!rule.conditions.length) continue
    const results = rule.conditions.map(c => evaluateCondition(c, lead))
    const match = rule.conditions_logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean)
    if (match) return rule
  }
  return null
}
