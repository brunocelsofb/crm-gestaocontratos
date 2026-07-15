import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForTokens, getGoogleUserEmail } from '@/lib/email/gmail'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(`${origin}/settings?email_error=${encodeURIComponent(oauthError)}`)
  }
  if (!code || !userId) {
    return NextResponse.redirect(`${origin}/settings?email_error=parametros_ausentes`)
  }

  try {
    const redirectUri = new URL('/api/auth/google/callback', request.url).toString()
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?email_error=sem_refresh_token`)
    }

    const email = await getGoogleUserEmail(tokens.access_token)
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const supabase = createAdminClient()
    await supabase.from('email_accounts').upsert(
      {
        user_id: userId,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(`${origin}/settings?email_connected=1`)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Falha desconhecida.'
    return NextResponse.redirect(`${origin}/settings?email_error=${encodeURIComponent(message)}`)
  }
}
