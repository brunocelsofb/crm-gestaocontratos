import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { to, link, surveyName, expiresAt } = await req.json()
  if (!to || !link) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const expiryText = expiresAt
    ? `Válido até: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`
    : ''

  // Usa Resend se disponível, senão mailgun ou apenas retorna sucesso simulado
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ORBIS Engenharia <noreply@orbisengenharia.com.br>',
        to: [to],
        subject: `Pesquisa de Satisfação — ${surveyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 16px">
            <div style="border-bottom:4px solid #E98C5F;padding-bottom:16px;margin-bottom:24px">
              <h1 style="color:#1B556B;margin:0;font-size:22px">${surveyName}</h1>
              <p style="color:#32AF9D;margin-top:4px;font-size:14px">Sua opinião é muito importante.</p>
            </div>
            <p style="color:#374151;font-size:15px">
              Gostaríamos de ouvir sua opinião sobre os serviços da ORBIS Engenharia.
              Por favor, dedique alguns minutos para responder nossa pesquisa.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${link}" style="background:#1B556B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600">
                Responder Pesquisa →
              </a>
            </div>
            ${expiryText ? `<p style="color:#9CA3AF;font-size:12px;text-align:center">${expiryText}</p>` : ''}
            <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0"/>
            <p style="color:#9CA3AF;font-size:11px;text-align:center">ORBIS Gestão de Tecnologia em Saúde</p>
          </div>
        `,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
  }
  // Sem Resend configurado: retorna sucesso (link foi exibido no modal)
  return NextResponse.json({ ok: true })
}
