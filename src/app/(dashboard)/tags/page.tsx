import { createClient } from '@/lib/supabase/server'
import { NewTagForm } from '@/components/tags/new-tag-form'
import { ConfirmDeleteButton } from '@/components/pipelines/confirm-delete-button'
import { deleteTag } from '@/lib/actions/tags'

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: tags } = await supabase.from('tags').select('id, name, color').order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Tags</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Use tags para identificar visualmente diferentes produtos ou categorias de contrato (ex: Engenharia Clínica, Engenharia Hospitalar).
        </p>
      </div>

      <NewTagForm />

      <div className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2 text-sm font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <form action={deleteTag.bind(null, tag.id)}>
              <ConfirmDeleteButton
                label="×"
                confirmMessage={`Excluir a tag "${tag.name}"? Ela some de todos os contratos que a usam.`}
                className="text-white/70 hover:text-white"
              />
            </form>
          </div>
        ))}
        {tags?.length === 0 && <p className="text-sm text-gray-400">Nenhuma tag criada ainda.</p>}
      </div>
    </div>
  )
}
