import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/email/gmail'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID não configurada no servidor. Peça pro admin configurar isso na Vercel.' },
      { status: 500 }
    )
  }

  const redirectUri = new URL('/api/auth/google/callback', request.url).toString()
  const url = getGoogleOAuthUrl(redirectUri, user.id)

  return NextResponse.redirect(url)
}
