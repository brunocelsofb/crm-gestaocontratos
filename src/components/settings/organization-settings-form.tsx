'use client'

import { useState, useRef, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateOrganizationSettings, updateOrganizationLogo, type ActionState } from '@/lib/actions/settings'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

const initialState: ActionState = {}

export function OrganizationSettingsForm({
  currentName,
  currentCompanyName,
  currentLogoPath,
  currentHeaderText,
  currentFooterText,
}: {
  currentName: string
  currentCompanyName: string
  currentLogoPath: string | null
  currentHeaderText: string
  currentFooterText: string
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, initialState)
  const [logoPath, setLogoPath] = useState(currentLogoPath)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setLogoError(null)

    const supabase = createClient()
    const storagePath = `logo/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setLogoError(`Falha no upload: ${uploadError.message}`)
      setUploadingLogo(false)
      return
    }

    const result = await updateOrganizationLogo(storagePath)
    setUploadingLogo(false)
    if (result.error) setLogoError(result.error)
    else setLogoPath(storagePath)
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700">Logo da empresa</label>
        <p className="mt-0.5 text-xs text-gray-400">Usado no cabeçalho do PDF das propostas comerciais.</p>
        {logoPath && (
          <img src={`/api/settings/logo?path=${encodeURIComponent(logoPath)}`} alt="Logo atual" className="mt-2 h-16 object-contain" />
        )}
        <div className="mt-2 flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="text-xs" />
          <button
            onClick={handleLogoUpload}
            disabled={uploadingLogo}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadingLogo ? 'Enviando...' : 'Enviar logo'}
          </button>
        </div>
        {logoError && <p className="mt-1 text-xs text-red-600">{logoError}</p>}
      </div>

      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome do sistema</label>
          <input
            name="name"
            required
            defaultValue={currentName}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">Aparece no menu lateral (ex: nome interno do sistema, tipo "Drone").</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nome da empresa (contratada)</label>
          <input
            name="company_name"
            defaultValue={currentCompanyName}
            placeholder="Ex: ORBIS Gestão de Tecnologia em Saúde"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Usado na pergunta da pesquisa NPS e no PDF das propostas — é o nome da sua empresa, não do sistema.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cabeçalho da proposta (opcional)</label>
          <input
            name="proposal_header_text"
            defaultValue={currentHeaderText}
            placeholder="Ex: www.orbisengenharia.com.br"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Rodapé da proposta (opcional)</label>
          <input
            name="proposal_footer_text"
            defaultValue={currentFooterText}
            placeholder="Ex: ORBIS Gestão de Tecnologia em Saúde · (62) 0000-0000"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">Cabeçalho e rodapé aparecem em todas as páginas de dados da proposta (não nas capas anexadas).</p>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
