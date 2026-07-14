// Validação de CPF pelo algoritmo padrão (dígitos verificadores) —
// mesma lógica usada pela Receita Federal. Funciona tanto no navegador
// quanto no servidor (função pura, sem dependências externas).
export function isValidCPF(rawCpf: string): boolean {
  const cpf = rawCpf.replace(/\D/g, '')

  if (cpf.length !== 11) return false
  // Rejeita sequências repetidas (111.111.111-11 etc.) — matematicamente
  // "válidas" pelo algoritmo, mas nunca são CPFs reais.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split('').map(Number)

  function checkDigit(base: number[]): number {
    let sum = 0
    let weight = base.length + 1
    for (const d of base) {
      sum += d * weight
      weight--
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstCheck = checkDigit(digits.slice(0, 9))
  if (firstCheck !== digits[9]) return false

  const secondCheck = checkDigit(digits.slice(0, 10))
  if (secondCheck !== digits[10]) return false

  return true
}

export function formatCPF(rawCpf: string): string {
  const cpf = rawCpf.replace(/\D/g, '').slice(0, 11)
  return cpf
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
