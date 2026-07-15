import { createClient } from '@/lib/supabase/server'
import { AutomationsManager } from '@/components/automations/automations-manager'

export default async function AutomationsPage() {
  const supabase = await createClient()

  const [{ data: rules }, { data: pipelines }, { data: stages }, { data: templates }, { data: users }] = await Promise.all([
    supabase.from('automation_rules').select('*').order('created_at', { ascending: false }),
    supabase.from('pipelines').select('id, name').order('name'),
    supabase.from('stages').select('id, name, pipeline_id').order('order_index'),
    supabase.from('email_templates').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Automações</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Configure regras do tipo &quot;quando X acontecer, faça Y&quot; — sem precisar de ninguém fazendo isso na mão.
        </p>
      </div>
      <AutomationsManager initialRules={rules ?? []} pipelines={pipelines ?? []} stages={stages ?? []} templates={templates ?? []} users={users ?? []} />
    </div>
  )
}
