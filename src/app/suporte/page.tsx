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

  const wallpaperUrl = settings?.support_bg_url ?? null

  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data } = admin.storage.from('proposal-files').getPublicUrl(settings.logo_storage_path)
    logoUrl = data.publicUrl
  }

  // Valida server-side — sem onError (Server Component não suporta event handlers)
  const isValidLogo = typeof logoUrl === 'string' && logoUrl.startsWith('https://')
  const isValidWallpaper = typeof wallpaperUrl === 'string' && wallpaperUrl.startsWith('https://')

  return (
    <main
      className={`min-h-screen w-full flex flex-col items-center justify-center relative ${!isValidWallpaper ? 'bg-gradient-to-br from-[#1B556B] via-[#0D3B4C] to-[#32AF9D]' : ''}`}
      style={isValidWallpaper ? { backgroundImage: `url(${wallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4 py-12 flex flex-col gap-6">
        <div className="text-center">
          {isValidLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl!} alt="Logo" className="mx-auto mb-3 h-12 object-contain" />
          ) : null}
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
