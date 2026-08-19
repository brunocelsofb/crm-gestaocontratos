import { getPublicBranding } from '@/lib/utils/public-branding'
import { LeadCaptureForm } from '@/components/leads/lead-capture-form'
import { LogoBadge } from '@/components/ui/logo-badge'

export const dynamic = 'force-dynamic'

export default async function PublicCapturePage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, lead_bg_url, logo_storage_path, company_name')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = settings?.logo_storage_path
  const rawBg   = (settings as any)?.lead_bg_url || settings?.support_bg_url

  let finalLogoUrl: string | null = null
  if (rawLogo && rawLogo.trim() && rawLogo !== 'null') {
    if (rawLogo.startsWith('http')) { finalLogoUrl = rawLogo }
    else {
      const { data } = admin.storage.from('public-assets').getPublicUrl(rawLogo)
      finalLogoUrl = data.publicUrl
    }
  }

  const wallpaperUrl = (rawBg && rawBg.startsWith('https://')) ? rawBg : null

  return (
    <div className="relative min-h-screen w-full">
      {/* Fundo fixo idêntico ao /suporte */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{
        backgroundImage: wallpaperUrl ? `url('${wallpaperUrl}')` : undefined,
        backgroundColor: '#1B556B',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      <main className="min-h-screen w-full flex flex-col items-center justify-start py-12 px-4">
        <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* Card com cabeçalho ORBIS */}
          <div className="w-full rounded-2xl bg-white/97 shadow-2xl overflow-hidden">
            <div className="p-6 pb-0">
              <div className="w-full border-b-4 border-[#E98C5F] pb-4 mb-6 flex flex-row items-center justify-between gap-4">
                <div className="flex-shrink-0">
                  <LogoBadge src={finalLogoUrl ?? undefined} />
                </div>
                <div className="text-right flex-1">
                  <h1 className="text-xl md:text-2xl font-bold text-[#1B556B]">Fale com a gente</h1>
                  <p className="text-xs md:text-sm font-medium text-[#32AF9D] mt-1">
                    Preencha os dados abaixo e entraremos em contato.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <LeadCaptureForm defaultPhone={phone} />
            </div>
          </div>

          <p className="text-center text-xs text-white/40">
            {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}
