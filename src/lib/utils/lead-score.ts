// Pontuação de lead baseada em sinais que a ORBIS realmente observa na
// prática (não só "preencheu o campo"): de onde veio, se o e-mail é
// corporativo, e se a empresa parece ser da área de saúde (o público
// certo). Cada critério devolve os pontos E o motivo, pra dar pra
// mostrar transparência de "por que esse lead tem essa nota".

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

const SOURCE_POINTS: Record<string, number> = {
  indicacao: 30,
  evento: 20,
  formulario_site: 15,
  ligacao: 15,
  anuncio: 5,
  manual: 10,
  outro: 5,
}

export type ScoreBreakdown = { label: string; points: number }

export function calculateLeadScore(fields: {
  email: string | null
  phone: string | null
  company_name: string | null
  message: string | null
  source: string | null
}): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = []

  const sourcePoints = SOURCE_POINTS[fields.source ?? 'outro'] ?? SOURCE_POINTS.outro
  breakdown.push({ label: `Origem (${fields.source ?? 'outro'})`, points: sourcePoints })

  if (fields.email) {
    const domain = fields.email.split('@')[1]?.toLowerCase().trim()
    if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
      breakdown.push({ label: 'E-mail corporativo', points: 25 })
    } else {
      breakdown.push({ label: 'E-mail pessoal (gmail, hotmail, etc.)', points: 5 })
    }
  }

  const nameToCheck = (fields.company_name ?? '').toLowerCase()
  const looksLikeHealth = HEALTH_KEYWORDS.some((kw) => nameToCheck.includes(kw))
  if (fields.company_name) {
    if (looksLikeHealth) {
      breakdown.push({ label: 'Empresa parece ser da área de saúde (perfil certo)', points: 25 })
    } else {
      breakdown.push({ label: 'Empresa informada, mas fora do perfil típico de saúde', points: 5 })
    }
  }

  if (fields.phone) breakdown.push({ label: 'Telefone informado (fácil de contatar)', points: 10 })

  if (fields.message && fields.message.length > 20) {
    breakdown.push({ label: 'Mensagem com algum detalhe', points: 10 })
  }

  const score = breakdown.reduce((sum, b) => sum + b.points, 0)
  return { score: Math.min(score, 100), breakdown }
}
