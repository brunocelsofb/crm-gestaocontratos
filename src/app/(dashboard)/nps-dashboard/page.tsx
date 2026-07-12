import { redirect } from 'next/navigation'

// O dashboard de NPS foi unificado com o de Pesquisas Customizadas — esse
// link antigo (favoritos, etc.) continua funcionando, só redireciona.
export default async function NpsDashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams({ tab: 'nps', ...params } as Record<string, string>)
  redirect(`/surveys-dashboard?${query.toString()}`)
}
