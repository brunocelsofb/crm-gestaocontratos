import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'

export const dynamic = 'force-dynamic'

export default async function PublicSupportPage() {
  const admin = createAdminClient()
  const { data: settings, error } = await admin
    .from('organization_settings')
    .select('support_bg_url, company_name, logo_storage_path')
    .eq('id', 'default')
    .maybeSingle()

  // Log removido após diagnóstico

  // support_bg_url já é URL pública completa
  const wallpaperUrl = settings?.support_bg_url ?? null

  // Logo: extrai base URL do Supabase a partir da support_bg_url ou usa a env var
  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    // Extrai base do projeto Supabase (ex: https://xxx.supabase.co)
    const supabaseBase = wallpaperUrl
      ? wallpaperUrl.split('/storage/')[0]
      : process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    logoUrl = `${supabaseBase}/storage/v1/object/public/proposal-files/${settings.logo_storage_path}`
  }

  const gradientStyle = {
    background: 'linear-gradient(135deg, #1B556B 0%, #0D3B4C 50%, #32AF9D 100%)',
  }

  const bgStyle = wallpaperUrl
    ? { backgroundImage: `url(${wallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : gradientStyle

  return (
    <div style={{ minHeight: '100vh', position: 'relative', ...bgStyle }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, width: '100%', maxWidth: 448 }}>
          {logoUrl
            ? <img src={logoUrl} alt="Logo" style={{ height: 48, objectFit: 'contain', margin: '0 auto 12px', display: 'block' }} />
            : null}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
            Abrir chamado de suporte
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
            Conta pra gente o que está acontecendo.
          </p>
        </div>

        {/* Card formulário */}
        <div style={{ width: '100%', maxWidth: 448, borderRadius: 16, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 24 }}>
          <SupportForm />
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
