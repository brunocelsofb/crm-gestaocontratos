import { createClient } from '@/lib/supabase/server'
import { EmailTemplatesManager } from '@/components/email/email-templates-manager'

export default async function EmailTemplatesPage() {
  const supabase = await createClient()

  const [{ data: templates }, { data: pipelines }, { data: stages }] = await Promise.all([
    supabase.from('email_templates').select('id, name, subject, body, trigger_stage_id, context').order('name'),
    supabase.from('pipelines').select('id, name').order('name'),
    supabase.from('stages').select('id, name, pipeline_id').order('order_index'),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Templates de E-mail</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crie modelos reutilizáveis — envie manualmente na conta do cliente, ou configure pra disparar sozinho quando o contrato entrar numa etapa específica.
        </p>
      </div>
      <EmailTemplatesManager initialTemplates={templates ?? []} pipelines={pipelines ?? []} stages={stages ?? []} />
    </div>
  )
}
