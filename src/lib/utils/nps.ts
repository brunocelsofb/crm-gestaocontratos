export type NpsCategory = 'promoter' | 'passive' | 'detractor'

export function categorizeScore(score: number): NpsCategory {
  if (score >= 9) return 'promoter'
  if (score >= 7) return 'passive'
  return 'detractor'
}

export function calculateNps(scores: number[]): {
  nps: number | null
  promoters: number
  passives: number
  detractors: number
  total: number
} {
  const total = scores.length
  if (total === 0) return { nps: null, promoters: 0, passives: 0, detractors: 0, total: 0 }

  let promoters = 0
  let passives = 0
  let detractors = 0

  for (const s of scores) {
    const cat = categorizeScore(s)
    if (cat === 'promoter') promoters++
    else if (cat === 'passive') passives++
    else detractors++
  }

  const nps = Math.round(((promoters - detractors) / total) * 100)

  return { nps, promoters, passives, detractors, total }
}
