'use client'

import { useState, useRef, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateOrganizationSettings, updateOrganizationLogo, type ActionState } from '@/lib/actions/settings'
import { sanitizeStorageFileName } from '@/lib/utils/storage'

const initialState: ActionState = {}

export function OrganizationSettingsForm({
  currentName,
  currentCompanyName,
  currentCompanyCnpj,
  currentLogoPath,
  currentHeaderText,
  currentFooterText,
  currentBrandColor,
  currentAssistantBudget,
  currentSupportBgUrl,
  currentNpsBgUrl,
  currentSurveyClinicaBgUrl,
  currentSurveyHospitalarBgUrl,
}: {
  currentName: string
  currentCompanyName: string
  currentCompanyCnpj: string
  currentLogoPath: string | null
  currentHeaderText: string
  currentFooterText: string
  currentBrandColor: string
  currentAssistantBudget: number
  currentSupportBgUrl?: string | null
  currentNpsBgUrl?: string | null
  currentSurveyClinicaBgUrl?: string | null
  currentSurveyHospitalarBgUrl?: string | null
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettings, initialState)
  const [logoPath, setLogoPath] = useState(currentLogoPath)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [bgPath, setBgPath] = useState(currentSupportBgUrl ?? null)

  // Helper genérico de upload para wallpapers públicos
  async function uploadPublicAsset(
    file: File, folder: string, column: string,
    setUploading: (v: boolean) => void,
    setError: (v: string | null) => void,
    setPath: (v: string) => void
  ) {
    setUploading(true); setError(null)
    const sb = createClient()
    const storagePath = `${folder}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await sb.storage.from('public-assets').upload(storagePath, file)
    if (uploadError) { setError(uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = sb.storage.from('public-assets').getPublicUrl(storagePath)
    const res = await fetch('/api/settings/public-asset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: publicUrl, column }),
    })
    setUploading(false)
    if (res.ok) setPath(publicUrl); else setError('Erro ao salvar')
  }

  const npsRef = useRef<HTMLInputElement>(null)
  const [npsBg, setNpsBg] = useState(currentNpsBgUrl ?? null)
  const [uploadingNps, setUploadingNps] = useState(false)
  const [npsErr, setNpsErr] = useState<string | null>(null)

  const clinicaRef = useRef<HTMLInputElement>(null)
  const [clinicaBg, setClinicaBg] = useState(currentSurveyClinicaBgUrl ?? null)
  const [uploadingClinica, setUploadingClinica] = useState(false)
  const [clinicaErr, setClinicaErr] = useState<string | null>(null)

  const hospitalarRef = useRef<HTMLInputElement>(null)
  const [hospitalarBg, setHospitalarBg] = useState(currentSurveyHospitalarBgUrl ?? null)
  const [uploadingHospitalar, setUploadingHospitalar] = useState(false)
  const [hospitalarErr, setHospitalarErr] = useState<string | null>(null)

  async function handleLogoUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setLogoError(null)

    const supabase = createClient()
    const storagePath = `logo/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('public-assets').upload(storagePath, file)

    if (uploadError) {
      setLogoError(`Falha no upload: ${uploadError.message}`)
      setUploadingLogo(false)
      return
    }

    // Pega URL pública do bucket public-assets
    const { data: { publicUrl: logoPubUrl } } = supabase.storage.from('public-assets').getPublicUrl(storagePath)
    
    // Salva URL pública no banco (mesmo padrão do wallpaper)
    const logoRes = await fetch('/api/settings/logo-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: logoPubUrl, path: storagePath }),
    })
    setUploadingLogo(false)
    if (!logoRes.ok) setLogoError('Erro ao salvar URL da logo')
    else setLogoPath(logoPubUrl)
  }

  async function handleBgUpload() {
    const file = bgInputRef.current?.files?.[0]
    if (!file) return
    setUploadingBg(true)
    setBgError(null)

    const supabase = createClient()
    const storagePath = `support-bg/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('public-assets').upload(storagePath, file)

    if (uploadError) {
      setBgError(`Falha no upload: ${uploadError.message}`)
      setUploadingBg(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(storagePath)

    // Salva a URL pública direto (não o path, pois é imagem pública)
    const res = await fetch('/api/settings/support-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: publicUrl }),
    })
    setUploadingBg(false)
    if (!res.ok) setBgError('Erro ao salvar URL do wallpaper')
    else setBgPath(publicUrl)
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
          <label className="block text-sm font-medium text-gray-700">CNPJ da empresa</label>
          <input
            name="company_cnpj"
            defaultValue={currentCompanyCnpj}
            placeholder="00.000.000/0000-00"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">Disponível como variável <code>{'{{minha_cnpj}}'}</code> nos templates de e-mail.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Cor da marca</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              name="proposal_brand_color"
              type="color"
              defaultValue={currentBrandColor}
              className="h-9 w-14 rounded border border-gray-300"
            />
            <span className="text-xs text-gray-400">Usada como faixa colorida no cabeçalho e rodapé do PDF das propostas.</span>
          </div>
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

      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <input type="hidden" name="name" value={currentName} />
        <input type="hidden" name="company_name" value={currentCompanyName} />
        <input type="hidden" name="proposal_header_text" value={currentHeaderText} />
        <input type="hidden" name="proposal_footer_text" value={currentFooterText} />
        <input type="hidden" name="proposal_brand_color" value={currentBrandColor} />

        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper do formulário de suporte</label>
          <p className="text-xs text-gray-400 mb-2">Imagem de fundo da página /suporte. Se não houver imagem, usa o degradê padrão da marca.</p>
          {(() => {
            const activePreview = bgPath || currentSupportBgUrl
            return activePreview ? (
              <div className="mt-2 mb-2 relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activePreview} alt="Wallpaper Atual" className="w-full h-full object-cover" />
              </div>
            ) : null
          })()}
          <div className="flex items-center gap-2">
            <input ref={bgInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" onClick={handleBgUpload} disabled={uploadingBg}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {uploadingBg ? 'Enviando...' : 'Enviar imagem'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tamanho recomendado: 1920×1080 pixels (Full HD). Formato JPG ou PNG. Máximo de 2MB para garantir carregamento rápido.
          </p>
          {bgError && <p className="mt-1 text-xs text-red-600">{bgError}</p>}
          {(bgPath ?? currentSupportBgUrl) && !uploadingBg && <p className="mt-1 text-xs text-green-600">✓ Wallpaper configurado</p>}
        </div>

        {/* NPS */}
        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper — NPS</label>
          {(npsBg || currentNpsBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(npsBg || currentNpsBgUrl)!} alt="nps bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={npsRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingNps} onClick={() => { const f = npsRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'nps-bg', 'nps_bg_url', setUploadingNps, setNpsErr, setNpsBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingNps ? 'Enviando...' : 'Enviar imagem'}</button>
          </div>
          {npsErr && <p className="mt-1 text-xs text-red-600">{npsErr}</p>}
        </div>

        {/* Pesquisa Clínica */}
        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper — Pesquisa Eng. Clínica</label>
          {(clinicaBg || currentSurveyClinicaBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(clinicaBg || currentSurveyClinicaBgUrl)!} alt="clínica bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={clinicaRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingClinica} onClick={() => { const f = clinicaRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'survey-clinica', 'survey_clinica_bg_url', setUploadingClinica, setClinicaErr, setClinicaBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingClinica ? 'Enviando...' : 'Enviar imagem'}</button>
          </div>
          {clinicaErr && <p className="mt-1 text-xs text-red-600">{clinicaErr}</p>}
        </div>

        {/* Pesquisa Hospitalar/Predial */}
        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper — Pesquisa Eng. Hospitalar/Predial</label>
          {(hospitalarBg || currentSurveyHospitalarBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(hospitalarBg || currentSurveyHospitalarBgUrl)!} alt="hospitalar bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={hospitalarRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingHospitalar} onClick={() => { const f = hospitalarRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'survey-hospitalar', 'survey_hospitalar_bg_url', setUploadingHospitalar, setHospitalarErr, setHospitalarBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingHospitalar ? 'Enviando...' : 'Enviar imagem'}</button>
          </div>
          {hospitalarErr && <p className="mt-1 text-xs text-red-600">{hospitalarErr}</p>}
          <p className="text-xs text-gray-500 mt-1">Recomendado: 1920×1080px, JPG/PNG/WebP, máx 2MB.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">🤖 Orçamento mensal do Théo (US$)</label>
          <input
            name="assistant_monthly_budget_usd"
            type="number"
            min="0"
            step="1"
            defaultValue={currentAssistantBudget}
            className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            Quando o gasto estimado do mês passar disso, o assistente para de responder até o mês seguinte (ou até você aumentar o valor aqui).
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {pending ? 'Salvando...' : 'Salvar orçamento'}
        </button>
      </form>
    </div>
  )
}
