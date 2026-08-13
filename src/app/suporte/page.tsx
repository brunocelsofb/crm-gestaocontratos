import { createAdminClient } from '@/lib/supabase/admin'
import { SupportForm } from './support-form'

export default async function PublicSupportPage() {
  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('organization_settings')
    .select('support_bg_url, company_name, logo_storage_path')
    .eq('id', 'default')
    .maybeSingle()

  const bgUrl = settings?.support_bg_url ?? null
  
  // Gera URL pública da logo via Storage
  let logoUrl: string | null = null
  if (settings?.logo_storage_path) {
    const { data: { publicUrl } } = admin.storage
      .from('proposal-files')
      .getPublicUrl(settings.logo_storage_path)
    logoUrl = publicUrl || null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        position: 'relative',
        ...(bgUrl
          ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : { background: 'linear-gradient(135deg, #1B556B 0%, #0D3B4C 50%, #32AF9D 100%)' }
        )
      }}
    >
      {/* Overlay sutil para contraste */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 448, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Logo / marca */}
        <div style={{ textAlign: 'center' }}>
          {logoUrl ? <img src={logoUrl} alt="Logo" style={{ margin: '0 auto 12px', height: 48, objectFit: 'contain', display: 'block' }} /> : null}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)', margin: 0 }}>Abrir chamado de suporte</h1>
          <p style={{ marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>Conta pra gente o que está acontecendo.</p>
        </div>

        {/* Card do formulário */}
        <div style={{ borderRadius: 16, background: 'rgba(255,255,255,0.97)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', padding: 24 }}>
          <SupportForm />
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
