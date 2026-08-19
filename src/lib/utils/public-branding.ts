import { createAdminClient } from '@/lib/supabase/admin'

export type PublicBranding = {
  wallpaperUrl: string | null
  loginBgUrl: string | null
  bgColor: string
  logoUrl: string | null
  companyName: string
}

export async function getPublicBranding(): Promise<PublicBranding> {
  const admin = createAdminClient()
  const { data: s } = await admin
    .from('organization_settings')
    .select('support_bg_url, login_bg_url, logo_storage_path, company_name, public_bg_color')
    .eq('id', 'default')
    .maybeSingle()

  const rawLogo = s?.logo_storage_path
  let logoUrl: string | null = null
  if (rawLogo && rawLogo.trim() && rawLogo !== 'null') {
    if (rawLogo.startsWith('http')) { logoUrl = rawLogo }
    else {
      const { data } = admin.storage.from('public-assets').getPublicUrl(rawLogo)
      logoUrl = data.publicUrl
    }
  }

  const rawBg = s?.support_bg_url
  const wallpaperUrl = (rawBg && rawBg.startsWith('https://')) ? rawBg : null

  const rawLogin = (s as any)?.login_bg_url
  const loginBgUrl = (rawLogin && rawLogin.startsWith('https://')) ? rawLogin : null

  return {
    wallpaperUrl,
    loginBgUrl,
    bgColor: (s as any)?.public_bg_color || '#1B556B',
    logoUrl,
    companyName: s?.company_name ?? 'ORBIS Engenharia',
  }
}
