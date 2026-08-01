// Validação de CPF — algoritmo Módulo 11 (Receita Federal)
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  // Rejeita sequências iguais (111.111.111-11, etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false

  const calc = (mod: number) => {
    let sum = 0
    for (let i = 0; i < mod - 1; i++) {
      sum += parseInt(digits[i]) * (mod - i)
    }
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }

  return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10])
}
