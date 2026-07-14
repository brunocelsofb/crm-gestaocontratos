import { LeadCaptureForm } from '@/components/leads/lead-capture-form'

export default function PublicCapturePage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Fale com a gente</h1>
          <p className="mt-1 text-sm text-gray-500">Preencha os dados abaixo e entraremos em contato.</p>
        </div>
        <LeadCaptureForm source="formulario" />
      </div>
    </div>
  )
}
