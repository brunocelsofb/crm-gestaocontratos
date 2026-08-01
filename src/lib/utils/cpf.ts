// Validação de CPF — algoritmo Módulo 11 (Receita Federal)
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  const calc = (mod: number) => {
    let sum = 0
    for (let i = 0; i < mod - 1; i++) sum += parseInt(digits[i]) * (mod - i)
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }
  return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10])
}

// Alias com maiúsculo para compatibilidade com client-decision-panel de julho
export const isValidCPF = isValidCpf

export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
