import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'
import { LogoBadge } from '@/components/ui/logo-badge'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function PublicSupportPage() {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, company_name, logo_storage_path')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogoPath = settings?.logo_storage_path
  const rawWallpaper = settings?.support_bg_url

  let finalLogoUrl: string | null = null
  if (rawLogoPath && rawLogoPath.trim() && rawLogoPath !== 'null') {
    if (rawLogoPath.startsWith('http')) {
      finalLogoUrl = rawLogoPath
    } else {
      const { data } = admin.storage.from('public-assets').getPublicUrl(rawLogoPath)
      finalLogoUrl = data.publicUrl
    }
  }

  const wallpaperUrl = (rawWallpaper && rawWallpaper.startsWith('https://'))
    ? rawWallpaper
    : null

  return (
    <div className="relative min-h-screen w-full">
      {/* Fundo fixo — sem overlay */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{
        backgroundImage: wallpaperUrl ? `url('${wallpaperUrl}')` : undefined,
        backgroundColor: '#1B556B',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      <main className="min-h-screen w-full flex flex-col items-center justify-start py-12 px-4">
        <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* Card formulário */}
          <div className="w-full rounded-2xl bg-white/97 shadow-2xl overflow-hidden">

            {/* Cabeçalho ORBIS */}
            <div className="p-6 pb-0">
              <div className="w-full border-b-4 border-[#E98C5F] pb-4 mb-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-4">
                <div className="flex-shrink-0">
                  <LogoBadge src={finalLogoUrl ?? undefined} />
                </div>
                <div className="text-center md:text-left">
                  <h1 className="text-xl md:text-2xl font-bold text-[#1B556B]">Abrir chamado de suporte</h1>
                  <p className="text-xs md:text-sm font-medium text-[#32AF9D] mt-1">Conta pra gente o que está acontecendo.</p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="p-6 pt-0">
              <SupportForm />
            </div>
          </div>

          <p className="text-center text-xs text-white/50">
            {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}
