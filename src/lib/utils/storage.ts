// O Supabase Storage rejeita certas chaves (caminhos) de arquivo — em
// especial acentos, espaços e alguns símbolos. O NOME de exibição (que
// o usuário vê e baixa) pode continuar sendo qualquer coisa, guardado
// à parte no banco — isso aqui só sanitiza o CAMINHO usado internamente.
export function sanitizeStorageFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos (ã → a, é → e, etc.)

  return normalized
    .replace(/[^a-zA-Z0-9._-]/g, '_') // troca qualquer coisa fora do seguro por _
    .replace(/_+/g, '_') // colapsa múltiplos _ seguidos
}
