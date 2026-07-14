import Link from 'next/link'
import { LeadCaptureForm } from '@/components/leads/lead-capture-form'

export default function NewLeadPage() {
  return (
    <div className="max-w-md space-y-4">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        ← Voltar
      </Link>
      <h1 className="text-[17px] font-medium text-foreground">Novo Lead</h1>
      <LeadCaptureForm source="manual" redirectAfter={(leadId) => `/leads/${leadId}`} />
    </div>
  )
}
