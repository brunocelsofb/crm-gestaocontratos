// Soma meses a uma data (formato 'YYYY-MM-DD'), lidando corretamente com
// meses de tamanhos diferentes (28/29/30/31 dias). Ex: 31/01 + 1 mês não
// vira "3 de março" (que seria o comportamento padrão, errado, do
// JavaScript) — em vez disso, cai no último dia de fevereiro.
export function addMonthsToDateString(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)

  const targetMonth = d.getMonth() + months
  d.setMonth(targetMonth)

  // Se o dia "vazou" pro mês seguinte (ex: 31/jan + 1 mês vira 3/mar em
  // vez de ficar em fevereiro), volta pro último dia do mês certo.
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0)
  }

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
