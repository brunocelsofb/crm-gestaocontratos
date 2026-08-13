import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'

export const dynamic = 'force-dynamic'

export default async function PublicSupportPage() {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, company_name, logo_storage_path')
    .eq('id', 'default')
    .maybeSingle()

  // Verificação estrita do valor raw antes de qualquer processamento
  const rawLogo = settings?.logo_storage_path
  const rawWallpaper = settings?.support_bg_url

  const finalLogoUrl = (rawLogo && rawLogo !== 'null' && rawLogo.trim() !== '')
    ? admin.storage.from('proposal-files').getPublicUrl(rawLogo).data.publicUrl
    : null

  // support_bg_url já é URL pública completa — não precisa de getPublicUrl
  const finalWallpaperUrl = (rawWallpaper && rawWallpaper !== 'null' && rawWallpaper.trim() !== '' && rawWallpaper.startsWith('https://'))
    ? rawWallpaper
    : null

  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1B556B] via-[#0D3B4C] to-[#32AF9D]"
      style={finalWallpaperUrl ? { backgroundImage: `url(${finalWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4 py-12 flex flex-col gap-6">
        <div className="text-center">
          {finalLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={finalLogoUrl} alt="Logo da Empresa" className="mx-auto mb-3 h-12 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-white drop-shadow">Abrir chamado de suporte</h1>
          <p className="mt-1 text-sm text-white/80">Conta pra gente o que está acontecendo.</p>
        </div>

        <div className="rounded-2xl bg-white shadow-2xl p-6">
          <SupportForm />
        </div>

        <p className="text-center text-xs text-white/40">
          {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
