import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddContactForm } from '@/components/companies/add-contact-form'
import { deleteContact } from '@/lib/actions/companies'
import { isCurrentUserAdmin } from '@/lib/auth/role'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const isAdmin = await isCurrentUserAdmin()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, trade_name, cnpj, notes, created_at')
    .eq('id', id)
    .single()

  if (!company) notFound()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, role, email, phone, is_primary')
    .eq('company_id', id)
    .order('created_at')

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, process_number, title, created_at')
    .eq('company_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{company.name}</h1>
          {company.trade_name && <p className="text-sm text-gray-500">{company.trade_name}</p>}
          {company.cnpj && <p className="mt-0.5 text-sm text-gray-500">CNPJ: {company.cnpj}</p>}
        </div>
        <Link
          href={`/companies/${company.id}/edit`}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Editar
        </Link>
      </div>

      {company.notes && (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{company.notes}</p>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Contatos</h2>
        <AddContactForm companyId={company.id} />

        <div className="space-y-2">
          {contacts?.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{contact.name}</span>
                  {contact.role && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">
                      {contact.role}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[contact.email, contact.phone].filter(Boolean).join(' · ') || 'Sem e-mail/telefone cadastrado'}
                </p>
              </div>
              {isAdmin && (
                <form action={deleteContact.bind(null, contact.id, company.id)}>
                  <button
                    type="submit"
                    className="text-xs text-gray-400 hover:text-negative-600"
                  >
                    Remover
                  </button>
                </form>
              )}
            </div>
          ))}
          {contacts?.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Nenhum contato cadastrado ainda.</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Contratos desta empresa</h2>
        <div className="space-y-2">
          {contracts?.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              <span className="font-mono text-gray-700">{c.process_number}</span>
              <span className="text-gray-500">{c.title}</span>
            </Link>
          ))}
          {contracts?.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Nenhum contrato vinculado a esta empresa ainda.</p>
          )}
        </div>
      </div>
    </div>
  )
}
