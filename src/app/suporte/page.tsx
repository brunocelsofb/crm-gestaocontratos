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
      className="relative min-h-screen bg-cover bg-center bg-no-repeat flex items-start justify-center px-4 py-12"
      style={bgUrl
        ? { backgroundImage: `url(${bgUrl})` }
        : { background: 'linear-gradient(135deg, #1B556B 0%, #0D3B4C 50%, #32AF9D 100%)' }
      }
    >
      {/* Overlay sutil para contraste */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

      <div className="relative z-10 w-full max-w-md space-y-5">
        {/* Logo / marca */}
        <div className="text-center">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="mx-auto h-12 object-contain mb-3" />
          )}
          <h1 className="text-2xl font-bold text-white drop-shadow">Abrir chamado de suporte</h1>
          <p className="mt-1 text-sm text-white/80">Conta pra gente o que está acontecendo.</p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl bg-white/95 shadow-2xl backdrop-blur-md p-6">
          <SupportForm />
        </div>

        <p className="text-center text-xs text-white/50">
          {settings?.company_name ?? 'ORBIS Engenharia'} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
