import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createNpsSurvey } from '@/lib/actions/nps'
import { CopyLinkButton } from '@/components/nps/copy-link-button'
import { categorizeScore } from '@/lib/utils/nps'

const CATEGORY_LABELS = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' } as const
const CATEGORY_STYLES = {
  promoter: 'bg-positive-100 text-positive-700',
  passive: 'bg-yellow-100 text-yellow-800',
  detractor: 'bg-negative-100 text-negative-700',
} as const

export async function NpsSection({ contractId }: { contractId: string }) {
  const supabase = await createClient()
  const { data: surveys } = await supabase
    .from('nps_surveys')
    .select('id, token, score, comment, status, sent_at, answered_at, respondent_name, respondent_email, respondent_phone')
    .eq('contract_id', contractId)
    .order('sent_at', { ascending: false })

  // NOTA DE INCERTEZA: uso o header "host" da requisição pra montar o link
  // absoluto (já que não tenho uma variável de ambiente fixa com o domínio
  // do site). Isso funciona bem atrás do proxy da Vercel, mas não testei
  // em outros ambientes de hospedagem — se o link vier errado, me avise.
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Pesquisa de satisfação (NPS)</h2>
        <form action={createNpsSurvey.bind(null, contractId)}>
          <button
            type="submit"
            className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            + Enviar pesquisa NPS
          </button>
        </form>
      </div>

      {surveys?.length === 0 && (
        <p className="text-sm text-gray-400">Nenhuma pesquisa enviada ainda.</p>
      )}

      <div className="space-y-2">
        {surveys?.map((s) => {
          const link = `${protocol}://${host}/nps/${s.token}`
          const category = s.status === 'answered' && s.score !== null ? categorizeScore(s.score) : null
          return (
            <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {s.status === 'answered' && category ? (
                    <>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[category]}`}>
                        {CATEGORY_LABELS[category]} — nota {s.score}
                      </span>
                      <span className="text-xs text-gray-400">
                        respondida em {s.answered_at ? new Date(s.answered_at).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                      Pendente
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  Enviada em {new Date(s.sent_at).toLocaleDateString('pt-BR')}
                </span>
              </div>

              {s.status === 'answered' && (
                <p className="mt-2 text-xs text-gray-500">
                  Respondido por <span className="font-medium text-gray-700">{s.respondent_name}</span>
                  {[s.respondent_email, s.respondent_phone].filter(Boolean).length > 0 &&
                    ` · ${[s.respondent_email, s.respondent_phone].filter(Boolean).join(' · ')}`}
                </p>
              )}

              {s.status === 'answered' && s.comment && (
                <p className="mt-2 text-sm text-gray-600">&ldquo;{s.comment}&rdquo;</p>
              )}

              {s.status === 'pending' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    className="flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500"
                  />
                  <CopyLinkButton link={link} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
