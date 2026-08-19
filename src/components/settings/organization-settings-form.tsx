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
  currentBgColor = '#1B556B',
  currentLoginBgUrl,
  currentLeadBgUrl,
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
  currentBgColor?: string
  currentLoginBgUrl?: string | null
  currentLeadBgUrl?: string | null
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
  const [bgColor, setBgColorState] = useState(currentBgColor ?? '#1B556B')
  const [savingColor, setSavingColor] = useState(false)
  const loginBgRef = useRef<HTMLInputElement>(null)
  const [loginBg, setLoginBg] = useState(currentLoginBgUrl ?? null)
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false)
  const [loginBgError, setLoginBgError] = useState<string | null>(null)
  const leadBgRef = useRef<HTMLInputElement>(null)
  const [leadBg, setLeadBg] = useState(currentLeadBgUrl ?? null)
  const [uploadingLeadBg, setUploadingLeadBg] = useState(false)
  const [leadBgError, setLeadBgError] = useState<string | null>(null)

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

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/settings/logo-url', { method: 'POST', body: formData })
    setUploadingLogo(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
      setLogoError(err.error || 'Erro ao fazer upload')
    } else {
      const { url } = await res.json()
      setLogoPath(url)
    }
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

  async function removeWallpaper(column: string, clearState: () => void) {
    if (!confirm('Remover o wallpaper? As telas voltarão ao gradiente padrão.')) return
    const res = await fetch('/api/settings/public-asset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column }),
    })
    if (res.ok) clearState()
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700">Logo da empresa (White Label)</label>
        <p className="mt-0.5 text-xs text-gray-400">Aparece no login, formulários públicos e propostas. Sem logo configurada, usa a logo DRONE como padrão.</p>
        {logoPath && (
          <img
            src={logoPath.startsWith('http') ? logoPath : `/api/settings/logo?path=${encodeURIComponent(logoPath)}`}
            alt="Logo atual"
            className="mt-2 h-16 object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
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
        {/* Nome do sistema oculto — logo substitui o texto no sidebar */}
        <input type="hidden" name="name" value={currentName} />

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

        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper da Tela de Login (/login)</label>
          {(loginBg || currentLoginBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(loginBg || currentLoginBgUrl)!} alt="login bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={loginBgRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingLoginBg} onClick={() => { const f = loginBgRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'login-bg', 'login_bg_url', setUploadingLoginBg, setLoginBgError, setLoginBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingLoginBg ? 'Enviando...' : 'Enviar imagem'}</button>
            {(loginBg || currentLoginBgUrl) && <button type="button" onClick={() => removeWallpaper('login_bg_url', () => setLoginBg(null))} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remover</button>}
          </div>
          {loginBgError && <p className="mt-1 text-xs text-red-600">{loginBgError}</p>}
          <p className="text-xs text-gray-500 mt-1">Se não configurado, usa o wallpaper de suporte como fallback.</p>
        </div>

          <label className="block text-sm font-medium text-gray-700">🎨 Cor de fundo (fallback sem wallpaper)</label>
          <div className="flex items-center gap-3 mt-1">
            <input type="color" value={bgColor} onChange={e => setBgColorState(e.target.value)}
              className="h-10 w-16 rounded border border-gray-300 cursor-pointer" />
            <span className="text-sm font-mono text-gray-600">{bgColor}</span>
            <button type="button" disabled={savingColor} onClick={async () => {
              setSavingColor(true)
              await fetch('/api/settings/public-asset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column: 'public_bg_color', value: bgColor }) })
              setSavingColor(false)
            }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {savingColor ? 'Salvando...' : 'Salvar cor'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Usada em Login, Leads e Pesquisas quando não há wallpaper configurado.</p>

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

        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper do formulário de Leads (/captura)</label>
          {(leadBg || currentLeadBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(leadBg || currentLeadBgUrl)!} alt="lead bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={leadBgRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingLeadBg} onClick={() => { const f = leadBgRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'lead-bg', 'lead_bg_url', setUploadingLeadBg, setLeadBgError, setLeadBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingLeadBg ? 'Enviando...' : 'Enviar imagem'}</button>
            {(leadBg || currentLeadBgUrl) && <button type="button" onClick={() => removeWallpaper('lead_bg_url', () => setLeadBg(null))} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remover</button>}
          </div>
          {leadBgError && <p className="mt-1 text-xs text-red-600">{leadBgError}</p>}
          <p className="text-xs text-gray-500 mt-1">Se não configurado, usa o wallpaper do formulário de suporte como fallback.</p>
        </div>
          {(bgPath ?? currentSupportBgUrl) && !uploadingBg && <p className="mt-1 text-xs text-green-600">✓ Wallpaper configurado</p>}
        </div>

        {/* NPS */}
        <div>
          <label className="block text-sm font-medium text-gray-700">🖼️ Wallpaper — NPS</label>
          {(npsBg || currentNpsBgUrl) && <div className="mt-2 mb-2 w-full h-24 rounded-lg overflow-hidden border border-gray-200"><img src={(npsBg || currentNpsBgUrl)!} alt="nps bg" className="w-full h-full object-cover" /></div>}
          <div className="flex items-center gap-2 mt-1">
            <input ref={npsRef} type="file" accept="image/png,image/jpeg,image/webp" className="text-xs" />
            <button type="button" disabled={uploadingNps} onClick={() => { const f = npsRef.current?.files?.[0]; if (f) uploadPublicAsset(f, 'nps-bg', 'nps_bg_url', setUploadingNps, setNpsErr, setNpsBg) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{uploadingNps ? 'Enviando...' : 'Enviar imagem'}</button>
            {(npsBg || currentNpsBgUrl) && <button type="button" onClick={() => removeWallpaper('nps_bg_url', () => setNpsBg(null))} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remover</button>}
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
            {(clinicaBg || currentSurveyClinicaBgUrl) && <button type="button" onClick={() => removeWallpaper('survey_clinica_bg_url', () => setClinicaBg(null))} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remover</button>}
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
            {(hospitalarBg || currentSurveyHospitalarBgUrl) && <button type="button" onClick={() => removeWallpaper('survey_hospitalar_bg_url', () => setHospitalarBg(null))} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remover</button>}
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
