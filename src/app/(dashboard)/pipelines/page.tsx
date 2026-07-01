import { createClient } from '@/lib/supabase/server'
import { NewPipelineForm } from '@/components/pipelines/new-pipeline-form'
import { ConfirmDeleteButton } from '@/components/pipelines/confirm-delete-button'
import { PipelineTypeSelect } from '@/components/pipelines/pipeline-type-select'
import { createStage, updateStage, deleteStage, moveStage, deletePipeline, updatePipelineType } from '@/lib/actions/pipelines'

export default async function PipelinesPage() {
  const supabase = await createClient()

  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name, description, is_default, type')
    .order('name')

  const { data: allStages } = await supabase
    .from('stages')
    .select('id, pipeline_id, name, order_index, color, sla_days, is_won, is_lost')
    .order('order_index')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Funis e Etapas</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Crie funis do zero e configure as etapas de cada um. Mudanças aqui afetam o Kanban e o Dashboard imediatamente.
        </p>
      </div>

      <NewPipelineForm />

      <div className="space-y-6">
        {pipelines?.map((pipeline) => {
          const stages = (allStages ?? []).filter((s) => s.pipeline_id === pipeline.id)

          return (
            <div key={pipeline.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-900">{pipeline.name}</h2>
                    {pipeline.is_default && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] text-brand-700">Padrão</span>
                    )}
                  </div>
                  {pipeline.description && <p className="text-xs text-gray-500">{pipeline.description}</p>}
                  <PipelineTypeSelect
                    defaultValue={pipeline.type}
                    action={updatePipelineType.bind(null, pipeline.id)}
                  />
                </div>
                {!pipeline.is_default && (
                  <form action={deletePipeline.bind(null, pipeline.id)}>
                    <ConfirmDeleteButton
                      label="Excluir funil"
                      confirmMessage={`Excluir o funil "${pipeline.name}"? Isso só é possível se não houver contratos nele.`}
                    />
                  </form>
                )}
              </div>

              <div className="space-y-2">
                {stages.map((stage, i) => (
                  <form
                    key={stage.id}
                    action={updateStage.bind(null, stage.id)}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 bg-gray-50 p-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <form action={moveStage.bind(null, stage.id, 'up')}>
                        <button type="submit" disabled={i === 0} className="block text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
                      </form>
                      <form action={moveStage.bind(null, stage.id, 'down')}>
                        <button type="submit" disabled={i === stages.length - 1} className="block text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
                      </form>
                    </div>

                    <input type="color" name="color" defaultValue={stage.color ?? '#6B7280'} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-300" />

                    <input
                      name="name"
                      defaultValue={stage.name}
                      className="min-w-[140px] flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-700 focus:outline-none"
                    />

                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      SLA
                      <input
                        type="number"
                        name="sla_days"
                        defaultValue={stage.sla_days ?? ''}
                        placeholder="dias"
                        className="w-16 rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-brand-700 focus:outline-none"
                      />
                    </label>

                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" name="is_won" defaultChecked={stage.is_won} />
                      Ganho
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" name="is_lost" defaultChecked={stage.is_lost} />
                      Perdido
                    </label>

                    <button
                      type="submit"
                      className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-800"
                    >
                      Salvar
                    </button>

                    <ConfirmDeleteButton
                      confirmMessage={`Remover a etapa "${stage.name}"? Só é possível se não houver contratos nela.`}
                    />
                  </form>
                ))}

                {stages.length === 0 && (
                  <p className="py-2 text-center text-xs text-gray-400">Nenhuma etapa ainda — adicione a primeira abaixo.</p>
                )}
              </div>

              <form action={createStage.bind(null, pipeline.id)} className="mt-3 flex gap-2">
                <input
                  name="name"
                  required
                  placeholder="Nome da nova etapa"
                  className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  + Etapa
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
