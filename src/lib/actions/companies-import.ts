'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ImportRow = {
  name: string
  cnpj: string | null
  trade_name: string | null
}

export type ImportResult = {
  imported: number
  skipped: number
  errors: string[]
}

export async function bulkImportCompanies(rows: ImportRow[]): Promise<ImportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { imported: 0, skipped: 0, errors: ['Usuário não autenticado.'] }

  const validRows = rows.filter((r) => r.name?.trim())
  if (validRows.length === 0) {
    return { imported: 0, skipped: 0, errors: ['Nenhuma linha com nome válido encontrada no arquivo.'] }
  }

  // Evita duplicar por CNPJ: verifica quais CNPJs do arquivo já existem
  // na base antes de inserir.
  const cnpjsInFile = validRows.map((r) => r.cnpj).filter((c): c is string => !!c)
  const { data: existing } = cnpjsInFile.length
    ? await supabase.from('companies').select('cnpj').in('cnpj', cnpjsInFile)
    : { data: [] as { cnpj: string | null }[] }

  const existingCnpjs = new Set((existing ?? []).map((c) => c.cnpj))

  const toInsert = validRows.filter((r) => !r.cnpj || !existingCnpjs.has(r.cnpj))
  const skipped = validRows.length - toInsert.length

  if (toInsert.length === 0) {
    return { imported: 0, skipped, errors: [] }
  }

  const { error } = await supabase.from('companies').insert(
    toInsert.map((r) => ({
      name: r.name.trim(),
      cnpj: r.cnpj,
      trade_name: r.trade_name,
      owner_id: user.id,
    }))
  )

  if (error) {
    return { imported: 0, skipped, errors: [error.message] }
  }

  revalidatePath('/companies')
  return { imported: toInsert.length, skipped, errors: [] }
}
