import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const GRADIENT = 'linear-gradient(to bottom right, #1B556B, #0D3B4C, #32AF9D)'

export default async function PublicSupportPage() {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, company_name, logo_storage_path')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = settings?.logo_storage_path
  const rawWallpaper = settings?.support_bg_url

  // Logo via getPublicUrl — salva path relativo no banco
  const finalLogoUrl = (rawLogo && rawLogo.trim() && rawLogo !== 'null')
    ? admin.storage.from('proposal-files').getPublicUrl(rawLogo).data.publicUrl
    : null

  // Wallpaper já é URL pública completa salva pelo upload
  const finalWallpaperUrl = (rawWallpaper && rawWallpaper.startsWith('https://'))
    ? rawWallpaper
    : null

  return (
    <main style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      // Ponto 2: gradiente como fallback CSS nativo
      backgroundImage: finalWallpaperUrl
        ? `url('${finalWallpaperUrl}'), ${GRADIENT}`
        : GRADIENT,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 448, padding: '48px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          {/* Ponto 3: logo como backgroundImage de div — sem ícone quebrado se 404 */}
          {finalLogoUrl && (
            <div style={{
              width: 160, height: 48,
              backgroundImage: `url('${finalLogoUrl}')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              margin: '0 auto 12px',
            }} />
          )}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            Abrir chamado de suporte
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            Conta pra gente o que está acontecendo.
          </p>
        </div>

        <div style={{ borderRadius: 16, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 24 }}>
          <SupportForm />
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
