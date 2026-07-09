'use client'

// Fluxo: CNPJ é o ponto de entrada.
// 1. Usuário digita o CNPJ e clica em "Verificar"
// 2. Verificamos primeiro se JÁ existe uma empresa com esse CNPJ no nosso
//    banco (find) — se sim, mostramos ela e os contatos dela para escolher
// 3. Se não existir no nosso banco, consultamos a BrasilAPI para sugerir
//    razão social/nome fantasia, e pedimos os dados de um contato novo
//    (a empresa E o primeiro contato são criados junto com o contrato)
//
// Os campos ficam como <input type="hidden"> para o form pai (que usa
// Server Action tradicional) capturar tudo no submit, sem precisar de
// state compartilhado entre componentes.

import { useState, useEffect } from 'react'
import { lookupCnpj } from '@/lib/actions/cnpj-lookup'
import { findCompanyByCnpj } from '@/lib/actions/companies'
import { createClient } from '@/lib/supabase/client'

type Contact = { id: string; name: string; role: string | null }
type FoundCompany = { id: string; name: string; trade_name: string | null; contacts: Contact[] }

export function CompanyContactSection({ preselectedCompanyId }: { preselectedCompanyId?: string }) {
  const [cnpj, setCnpj] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [loadingPreselected, setLoadingPreselected] = useState(!!preselectedCompanyId)

  const [foundCompany, setFoundCompany] = useState<FoundCompany | null>(null)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyTradeName, setNewCompanyTradeName] = useState('')

  const [selectedContactId, setSelectedContactId] = useState('')
  const [wantsNewContact, setWantsNewContact] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactRole, setNewContactRole] = useState('')
  const [newContactEmail, setNewContactEmail] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')

  useEffect(() => {
    if (!preselectedCompanyId) return

    async function loadPreselected() {
      const supabase = createClient()
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, trade_name')
        .eq('id', preselectedCompanyId!)
        .maybeSingle()

      if (!company) {
        setLoadingPreselected(false)
        return
      }

      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, role')
        .eq('company_id', preselectedCompanyId!)
        .order('created_at')

      setFoundCompany({ ...company, contacts: contacts ?? [] })
      setChecked(true)
      setLoadingPreselected(false)
    }

    loadPreselected()
  }, [preselectedCompanyId])

  async function handleCheck() {
    setError(null)
    setChecking(true)
    setChecked(false)
    setFoundCompany(null)

    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) {
      setError('CNPJ precisa ter 14 dígitos.')
      setChecking(false)
      return
    }

    // 1. Já existe na nossa base?
    const existing = await findCompanyByCnpj(digits)
    if (existing) {
      setFoundCompany(existing)
      setChecked(true)
      setChecking(false)
      return
    }

    // 2. Não existe — sugere dados via BrasilAPI (best-effort, pode falhar)
    const lookup = await lookupCnpj(digits)
    if (lookup.success) {
      setNewCompanyName(lookup.razaoSocial)
      setNewCompanyTradeName(lookup.nomeFantasia ?? '')
    } else {
      setNewCompanyName('')
      setNewCompanyTradeName('')
    }
    setWantsNewContact(true)
    setChecked(true)
    setChecking(false)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-900">Empresa e contato responsável</p>

      {loadingPreselected && <p className="text-sm text-gray-400">Carregando empresa...</p>}

      {!preselectedCompanyId && (
        <div>
          <label className="block text-xs font-medium text-gray-700">
            CNPJ <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={cnpj}
              onChange={(e) => {
                setCnpj(e.target.value)
                setChecked(false)
              }}
              placeholder="00.000.000/0000-00"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking || cnpj.replace(/\D/g, '').length !== 14}
              className="whitespace-nowrap rounded-md border border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {checked && foundCompany && (
        <div className="rounded-md border border-positive-200 bg-positive-100 p-3">
          <input type="hidden" name="existing_company_id" value={foundCompany.id} />
          <p className="text-sm font-medium text-positive-700">
            ✓ Empresa já cadastrada: {foundCompany.name}
          </p>
          {foundCompany.trade_name && <p className="text-xs text-positive-700">{foundCompany.trade_name}</p>}

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700">Contato responsável *</label>
            {!wantsNewContact ? (
              <>
                <select
                  name="existing_contact_id"
                  required={!wantsNewContact}
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
                >
                  <option value="">Selecione um contato...</option>
                  {foundCompany.contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setWantsNewContact(true)}
                  className="mt-1 text-xs text-brand-700 hover:underline"
                >
                  + Cadastrar novo contato para esta empresa
                </button>
              </>
            ) : (
              <NewContactFields
                name={newContactName} setName={setNewContactName}
                role={newContactRole} setRole={setNewContactRole}
                email={newContactEmail} setEmail={setNewContactEmail}
                phone={newContactPhone} setPhone={setNewContactPhone}
                onCancel={foundCompany.contacts.length > 0 ? () => setWantsNewContact(false) : undefined}
              />
            )}
          </div>
        </div>
      )}

      {checked && !foundCompany && (
        <div className="rounded-md border border-brand-100 bg-white p-3">
          <input type="hidden" name="new_company_cnpj" value={cnpj.replace(/\D/g, '')} />
          <p className="mb-2 text-xs text-gray-500">
            Empresa nova — não encontramos esse CNPJ na sua base ainda. Confira os dados abaixo antes de salvar.
          </p>

          <label className="block text-xs font-medium text-gray-700">Razão Social *</label>
          <input
            name="new_company_name"
            required
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />

          <label className="mt-2 block text-xs font-medium text-gray-700">Nome Fantasia</label>
          <input
            name="new_company_trade_name"
            value={newCompanyTradeName}
            onChange={(e) => setNewCompanyTradeName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
          />

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700">Contato responsável *</label>
            <NewContactFields
              name={newContactName} setName={setNewContactName}
              role={newContactRole} setRole={setNewContactRole}
              email={newContactEmail} setEmail={setNewContactEmail}
              phone={newContactPhone} setPhone={setNewContactPhone}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function NewContactFields({
  name, setName, role, setRole, email, setEmail, phone, setPhone, onCancel,
}: {
  name: string; setName: (v: string) => void
  role: string; setRole: (v: string) => void
  email: string; setEmail: (v: string) => void
  phone: string; setPhone: (v: string) => void
  onCancel?: () => void
}) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="col-span-2 sm:col-span-1">
        <input
          name="new_contact_name"
          required
          placeholder="Nome *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <input
          name="new_contact_role"
          placeholder="Cargo"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <input
          name="new_contact_email"
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <input
          name="new_contact_phone"
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-700 focus:outline-none"
        />
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} className="col-span-2 text-left text-xs text-gray-400 hover:underline">
          Cancelar, escolher contato existente
        </button>
      )}
    </div>
  )
}
