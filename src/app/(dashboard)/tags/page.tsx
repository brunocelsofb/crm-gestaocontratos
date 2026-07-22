import { createClient } from '@/lib/supabase/server'
import { NewTagForm } from '@/components/tags/new-tag-form'
import { TagsManager } from '@/components/tags/tags-manager'

export default async function TagsPage() {
  const supabase = await createClient()
  const { data: tags } = await supabase.from('tags').select('id, name, color').order('name')

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Tags</h1>
        <p style={{ fontSize: 12, color: '#8892a4', marginTop: 4 }}>
          Identifique visualmente produtos ou categorias de contrato (ex: Engenharia Clínica, Engenharia Hospitalar).
        </p>
      </div>
      <NewTagForm />
      <TagsManager initialTags={tags ?? []} />
    </div>
  )
}
