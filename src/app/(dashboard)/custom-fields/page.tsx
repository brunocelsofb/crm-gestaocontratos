import { createClient } from '@/lib/supabase/server'
import { CustomFieldsManager } from '@/components/custom-fields/custom-fields-manager'

export default async function CustomFieldsPage() {
  const supabase = await createClient()
  const { data: fields } = await supabase.from('custom_fields').select('id, name, field_key, field_type, select_options').order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Campos Customizados</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crie campos extras pra preencher em cada contrato (ex: Data de Início, Tipo de Projeto) — depois use como variável em qualquer template de e-mail.
        </p>
      </div>
      <CustomFieldsManager initialFields={fields ?? []} />
    </div>
  )
}
