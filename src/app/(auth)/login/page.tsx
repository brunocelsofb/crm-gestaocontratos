import { createAdminClient } from '@/lib/supabase/admin'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, logo_storage_path, company_name')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = settings?.logo_storage_path
  const rawBg   = settings?.support_bg_url

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
      <div className="fixed inset-0 pointer-events-none -z-10" style={{
        backgroundImage: wallpaperUrl ? `url('${wallpaperUrl}')` : undefined,
        backgroundColor: '#1B556B',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />
      <main className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col gap-5">
          <div className="w-full rounded-2xl bg-white/97 shadow-2xl overflow-hidden">
            <div className="p-6 pb-0">
              <div className="w-full border-b-4 border-[#E98C5F] pb-4 mb-6 flex flex-row items-center justify-between gap-4">
                {finalLogoUrl && (
                  <div style={{ width: 40, height: 40, flexShrink: 0, backgroundImage: `url('${finalLogoUrl}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
                )}
                <div className="text-right flex-1">
                  <h1 className="text-xl font-bold text-[#1B556B]">Entrar</h1>
                  <p className="text-xs font-medium text-[#32AF9D] mt-0.5">Acesse o CRM de Contratos</p>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <LoginForm />
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
