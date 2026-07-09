'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function registerContractFile(
  contractId: string,
  fileName: string,
  storagePath: string,
  fileSize: number,
  mimeType: string
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Usuário não autenticado.' }

  const { error } = await supabase.from('contract_files').insert({
    contract_id: contractId,
    file_name: fileName,
    storage_path: storagePath,
    file_size: fileSize,
    mime_type: mimeType,
    uploaded_by: user.id,
  })

  if (error) return { error: error.message }

  await supabase.from('activities').insert({
    contract_id: contractId,
    user_id: user.id,
    type: 'system',
    content: `Arquivo "${fileName}" anexado.`,
  })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}

export async function deleteContractFile(fileId: string, contractId: string, storagePath: string) {
  const supabase = await createClient()

  await supabase.storage.from('contract-files').remove([storagePath])
  await supabase.from('contract_files').delete().eq('id', fileId)

  revalidatePath(`/contracts/${contractId}`)
}

// Gera um link temporário de download (o arquivo é privado — não tem
// URL pública fixa). NOTA DE INCERTEZA: a duração exata que o link fica
// válido (aqui, 1 hora) é configurável; ajuste o número se precisar de
// mais tempo.
export async function getFileDownloadUrl(storagePath: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('contract-files')
    .createSignedUrl(storagePath, 3600)

  if (error || !data) return { error: error?.message ?? 'Falha ao gerar link.' }
  return { url: data.signedUrl }
}
