// Motor de Lead Scoring — lê regras do banco (lead_scoring_rules).
// Fallback para regras hardcoded se banco não disponível.

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
  'live.com', 'icloud.com', 'bol.com.br', 'uol.com.br', 'terra.com.br',
  'ig.com.br', 'globo.com', 'msn.com', 'r7.com', 'zipmail.com.br',
])

const HEALTH_KEYWORDS = [
  'hospital', 'clinica', 'clínica', 'saude', 'saúde', 'upa', 'ubs',
  'laborator', 'medic', 'médic', 'diagnostic', 'diagnóstic', 'enfermagem',
  'hemodialise', 'hemodiálise', 'oncolog', 'cirurgic', 'cirúrgic',
  'health', 'ambulator', 'pronto socorro', 'maternidade', 'policlinic',
]

export type ScoringRule = {
  criterion_key: string
  label: string
  points: number
  is_active: boolean
  description?: string | null
}

export type ScoreBreakdown = { label: string; points: number }

// Resolve qual criterion_key de source usar
function sourceKey(source: string | null): string {
  const map: Record<string, string> = {
    indicacao: 'source_indicacao',
    evento: 'source_evento',
    formulario_site: 'source_formulario',
    ligacao: 'source_ligacao',
    manual: 'source_manual',
    anuncio: 'source_anuncio',
  }
  return map[source ?? ''] ?? 'source_outro'
}

export function calculateLeadScore(
  fields: {
    email: string | null
    phone: string | null
    company_name: string | null
    message: string | null
    source: string | null
  },
  rules?: ScoringRule[]
): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = []

  // Helper: busca pontuação de uma regra pelo key
  function pts(key: string, fallback: number): number {
    if (!rules) return fallback
    const rule = rules.find(r => r.criterion_key === key && r.is_active)
    return rule?.points ?? 0
  }
  function label(key: string, fallbackLabel: string): string {
    if (!rules) return fallbackLabel
    const rule = rules.find(r => r.criterion_key === key && r.is_active)
    return rule?.label ?? fallbackLabel
  }

  // Origem
  const sk = sourceKey(fields.source)
  const sourcePoints = pts(sk, 10)
  if (!rules || rules.find(r => r.criterion_key === sk && r.is_active)) {
    breakdown.push({ label: label(sk, `Origem (${fields.source ?? 'outro'})`), points: sourcePoints })
  }

  // E-mail
  if (fields.email) {
    const domain = fields.email.split('@')[1]?.toLowerCase().trim()
    const isCorporate = domain && !FREE_EMAIL_DOMAINS.has(domain)
    const key = isCorporate ? 'corporate_email' : 'personal_email'
    const p = pts(key, isCorporate ? 25 : 5)
    const l = label(key, isCorporate ? 'E-mail corporativo' : 'E-mail pessoal')
    if (!rules || rules.find(r => r.criterion_key === key && r.is_active)) {
      breakdown.push({ label: l, points: p })
    }
  }

  // Empresa / setor
  if (fields.company_name) {
    const nameLC = fields.company_name.toLowerCase()
    const isHealth = HEALTH_KEYWORDS.some(kw => nameLC.includes(kw))
    const key = isHealth ? 'health_sector_fit' : 'other_sector'
    const p = pts(key, isHealth ? 25 : 5)
    const l = label(key, isHealth ? 'Empresa do setor de saúde' : 'Empresa fora do perfil de saúde')
    if (!rules || rules.find(r => r.criterion_key === key && r.is_active)) {
      breakdown.push({ label: l, points: p })
    }
  }

  // Telefone
  if (fields.phone) {
    const p = pts('phone_provided', 10)
    const l = label('phone_provided', 'Telefone informado')
    if (!rules || rules.find(r => r.criterion_key === 'phone_provided' && r.is_active)) {
      breakdown.push({ label: l, points: p })
    }
  }

  // Mensagem
  if (fields.message && fields.message.length > 20) {
    const p = pts('message_detailed', 10)
    const l = label('message_detailed', 'Mensagem com algum detalhe')
    if (!rules || rules.find(r => r.criterion_key === 'message_detailed' && r.is_active)) {
      breakdown.push({ label: l, points: p })
    }
  }

  const score = breakdown.reduce((s, b) => s + b.points, 0)
  return { score: Math.min(Math.max(score, 0), 100), breakdown }
}
