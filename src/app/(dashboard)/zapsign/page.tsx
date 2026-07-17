import { createClient } from '@/lib/supabase/server'
import { createZapSignTemplate, deleteZapSignTemplate } from '@/lib/actions/zapsign'
import Link from 'next/link'

export default async function ZapSignTemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('zapsign_templates').select('*').order('created_at', { ascending: false })
  const { data: settings } = await supabase.from('organization_settings').select('zapsign_api_token').eq('id', 'default').maybeSingle()
  const isConnected = !!settings?.zapsign_api_token

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Modelos ZapSign</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Cadastre aqui os modelos de contrato/aditivo que você criou no ZapSign. Cole o token do modelo (encontrado no painel da ZapSign em Modelos → ver modelo → token).
          </p>
        </div>
        {!isConnected && (
          <Link href="/settings" className="rounded-md border border-yellow-400 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 hover:bg-yellow-100">
            ⚠️ Configure o token da ZapSign
          </Link>
        )}
      </div>

      <form action={async (fd: FormData) => { await createZapSignTemplate(fd) }} className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-medium text-gray-700">+ Novo modelo</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500">Nome do modelo</label>
            <input name="name" required placeholder="Ex: Contrato Padrão ORBIS" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Tipo</label>
            <select name="type" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none">
              <option value="contrato">Contrato</option>
              <option value="aditivo">Aditivo</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Token do modelo no ZapSign</label>
          <input name="zapsign_template_token" required placeholder="Cole o token que aparece no painel da ZapSign" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-mono focus:border-brand-700 focus:outline-none" />
          <p className="mt-0.5 text-xs text-gray-400">ZapSign → Modelos → clica no modelo → copia o token que aparece no URL ou nos detalhes.</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Descrição (opcional)</label>
          <input name="description" placeholder="Ex: Modelo padrão pra novos projetos de tecnologia em saúde" className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none" />
        </div>
        <button type="submit" className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
          Salvar modelo
        </button>
      </form>

      <div className="space-y-1.5">
        {(templates ?? []).map((t) => (
          <div key={t.id} className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div>
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.type === 'aditivo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{t.type}</span>
              {t.description && <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>}
              <p className="mt-0.5 font-mono text-[10px] text-gray-400">{t.zapsign_template_token}</p>
            </div>
            <form action={async (fd: FormData) => { await deleteZapSignTemplate(t.id) }}>
              <button type="submit" className="text-xs text-negative-600 hover:underline">Remover</button>
            </form>
          </div>
        ))}
        {(templates ?? []).length === 0 && <p className="text-sm text-gray-400">Nenhum modelo cadastrado ainda.</p>}
      </div>
    </div>
  )
}
