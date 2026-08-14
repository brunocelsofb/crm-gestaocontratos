import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'

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

  const rawLogo = settings?.logo_storage_path
  const rawWallpaper = settings?.support_bg_url

  const logoUrl = (rawLogo && rawLogo.trim() && rawLogo !== 'null')
    ? admin.storage.from('public-assets').getPublicUrl(rawLogo).data.publicUrl
    : null

  // Wallpaper puro — sem gradient sobreposto
  const wallpaperUrl = (rawWallpaper && rawWallpaper.startsWith('https://'))
    ? rawWallpaper
    : null

  return (
    <div className="relative min-h-screen w-full">
      {/* Fundo puro sem filtros */}
      <div className="fixed inset-0 pointer-events-none -z-10" style={{
        backgroundImage: wallpaperUrl ? `url('${wallpaperUrl}')` : undefined,
        backgroundColor: '#1B556B',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      <main className="min-h-screen w-full flex flex-col items-center justify-start py-12 px-4">
        <div style={{ width: '100%', maxWidth: 448, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Logo */}
          {logoUrl && (
            <div style={{ width: 160, height: 48, backgroundImage: `url('${logoUrl}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', margin: '0 auto' }} />
          )}

          {/* Card com cabeçalho padrão ORBIS */}
          <div style={{ borderRadius: 16, background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ borderBottom: '4px solid #E98C5F', paddingBottom: 16, marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B556B', margin: 0 }}>
                  Abrir chamado de suporte
                </h1>
                <p style={{ fontSize: 14, color: '#64748b', marginTop: 6, margin: '6px 0 0' }}>
                  Conta pra gente o que está acontecendo.
                </p>
              </div>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <SupportForm />
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  )
}
