// Utilitários de CNPJ — sem 'use server', pode ser importado em qualquer lugar
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

export function formatCnpj(cnpj: string): string {
  const d = normalizeCnpj(cnpj)
  if (d.length !== 14) return cnpj
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
