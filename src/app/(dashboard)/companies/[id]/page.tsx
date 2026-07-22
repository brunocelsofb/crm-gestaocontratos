import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { DeleteCompanyButton } from '@/components/companies/delete-company-button'
import { CompanyTagSelect } from '@/components/companies/company-tag-select'
import { NewOpportunityButton } from '@/components/companies/new-opportunity-button'
import { AddContactForm } from '@/components/companies/add-contact-form'
import { RemoveContactButton } from '@/components/companies/remove-contact-button'
import { ActivityFeed } from '@/components/activities/activity-feed'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  lead:           { bg: '#eef3ff', color: '#3b5bdb', label: 'Lead' },
  prospect:       { bg: '#f0eeff', color: '#5f38c9', label: 'Prospect' },
  cliente_ativo:  { bg: '#eaf5ee', color: '#1a7c3e', label: 'Cliente Ativo' },
  cliente_inativo:{ bg: '#fff8e6', color: '#92400e', label: 'Cliente Inativo' },
  nao_qualificado:{ bg: '#f1f3f8', color: '#8892a4', label: 'Não qualificado' },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function parseMulti(val: string | null | undefined): string[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [val] }
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    isAdmin,
    { data: company },
    { data: contacts },
    { data: contracts },
    { data: activities },
    { data: profiles },
    { data: salesPipelines },
    { data: allTags },
    { data: companyTagRow },
  ] = await Promise.all([
    isCurrentUserAdmin(),
    supabase.from('companies').select('*').eq('id', id).single(),
    supabase.from('contacts').select('id, name, role, email, phone, is_primary').eq('company_id', id).order('is_primary', { ascending: false }),
    supabase.from('contracts').select('id, process_number, title, created_at, value').eq('company_id', id).order('created_at', { ascending: false }),
    supabase.from('activities').select('id, type, activity_type, title, content, status, activity_date, activity_time, duration_minutes, created_at, user_id, assigned_to').eq('company_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('pipelines').select('id, name, is_default').eq('type', 'vendas').order('name'),
    supabase.from('tags').select('id, name, color').order('name'),
    supabase.from('company_tags').select('tag_id').eq('company_id', id).maybeSingle(),
  ])

  if (!company) notFound()

  // Busca leads vinculados à empresa por CNPJ ou nome
  const cnpjDigits = company?.cnpj?.replace(/\D/g, '') ?? null
  let leadsQuery = supabase.from('leads').select('id, name, email, status, score, created_at, source').order('created_at', { ascending: false }).limit(20)
  if (cnpjDigits) {
    leadsQuery = supabase.from('leads').select('id, name, email, status, score, created_at, source')
      .or(`cnpj.eq.${cnpjDigits},company_name.ilike.${company.name}`)
      .order('created_at', { ascending: false }).limit(20)
  } else if (company.name) {
    leadsQuery = supabase.from('leads').select('id, name, email, status, score, created_at, source')
      .ilike('company_name', company.name)
      .order('created_at', { ascending: false }).limit(20)
  }
  const { data: companyLeads } = await leadsQuery

  const defaultSalesPipeline = (salesPipelines ?? []).find(p => p.is_default)?.id ?? salesPipelines?.[0]?.id
  const salesPipelinesList = (salesPipelines ?? []).map(p => ({ id: p.id, name: p.name }))

  if (!company) notFound()

  const profileById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
  const st = STATUS_STYLE[(company as any).status ?? 'lead'] ?? STATUS_STYLE.lead
  const segmentos = parseMulti((company as any).segment)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link href="/companies" style={{ fontSize: 12, color: '#8892a4', textDecoration: 'none' }}>← Empresas</Link>

      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1f36', margin: 0 }}>{company.name}</h1>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
              <CompanyTagSelect
                companyId={company.id}
                currentTagId={(companyTagRow as any)?.tag_id ?? null}
                tags={allTags ?? []}
              />
              {segmentos.map(s => <span key={s} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, background: '#f1f3f8', color: '#52514e' }}>{s}</span>)}
            </div>
            {(company as any).trade_name && <p style={{ fontSize: 13, color: '#52514e', marginBottom: 4 }}>{(company as any).trade_name}</p>}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#8892a4' }}>
              {company.cnpj && <span>CNPJ: <strong style={{ color: '#1a1f36', fontFamily: 'monospace' }}>{company.cnpj}</strong></span>}
              {(company as any).city && <span>📍 {(company as any).city}{(company as any).state ? `/${(company as any).state}` : ''}</span>}
              {(company as any).phone && <span>📞 {(company as any).phone}</span>}
              {(company as any).email && <span>✉ {(company as any).email}</span>}
              {(company as any).capital_social && <span>💰 Capital: {fmt(Number((company as any).capital_social))}</span>}
              {(company as any).main_activity && <span>🏭 {(company as any).main_activity}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Link href={`/companies/${company.id}/edit`} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8, border: '0.5px solid #d1d8e8', background: '#fff', color: '#52514e', textDecoration: 'none' }}>Editar</Link>
            {isAdmin && <DeleteCompanyButton companyId={company.id} />}
          </div>
        </div>
        {/* Endereço */}
        {((company as any).street || (company as any).neighborhood) && (
          <p style={{ fontSize: 12, color: '#8892a4', marginTop: 8, borderTop: '0.5px solid #f1f3f8', paddingTop: 8 }}>
            {[(company as any).street, (company as any).street_number, (company as any).neighborhood, (company as any).zip_code].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Coluna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Visão Geral / Atividades */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Histórico de Atividades</p>
            </div>
            <div style={{ padding: 16 }}>
              <ActivityFeed
              activities={activities ?? []}
              companyId={company.id}
              profiles={profiles ?? []}
              currentUserId={user?.id ?? ''}
            />
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(activities ?? []).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, paddingBottom: 10, borderBottom: '0.5px solid #f8f9fb' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, color: '#52514e' }}>
                      {a.type === 'note' ? '📝' : a.type === 'email' ? '✉' : '🔔'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, color: '#1a1f36', margin: 0 }}>{a.content}</p>
                      <p style={{ fontSize: 10, color: '#b0b8c8', marginTop: 3 }}>
                        {a.user_id ? profileById.get(a.user_id) : 'Sistema'} · {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {(activities ?? []).length === 0 && (
                  <p style={{ fontSize: 12, color: '#b0b8c8', textAlign: 'center', padding: '24px 0' }}>Nenhuma atividade registrada ainda.</p>
                )}
              </div>
            </div>
          </div>

          {/* Leads vinculados */}
          {(companyLeads ?? []).length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Leads ({(companyLeads ?? []).length})</p>
                <Link href="/leads" style={{ fontSize: 11, color: '#4f86f7', textDecoration: 'none' }}>Ver todos os leads →</Link>
              </div>
              <div>
                {(companyLeads ?? []).map(l => {
                  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
                    novo: { bg: '#eef3ff', color: '#3b5bdb' },
                    em_qualificacao: { bg: '#fff8e6', color: '#92400e' },
                    qualificado: { bg: '#eaf5ee', color: '#1a7c3e' },
                    convertido: { bg: '#f0eeff', color: '#5f38c9' },
                    descartado: { bg: '#f1f3f8', color: '#8892a4' },
                  }
                  const st = STATUS_STYLE[l.status] ?? STATUS_STYLE.novo
                  const STATUS_LABEL: Record<string, string> = { novo: 'Novo', em_qualificacao: 'Em Qualificação', qualificado: 'Qualificado', convertido: 'Convertido', descartado: 'Descartado' }
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #f8f9fb' }}>
                      <div>
                        <Link href={`/leads/${l.id}`} style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', textDecoration: 'none' }}>{l.name}</Link>
                        <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{l.email ?? '—'} · {new Date(l.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: st.bg, color: st.color }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Oportunidades vinculadas */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Oportunidades ({(contracts ?? []).length})</p>
              <NewOpportunityButton
                companyId={company.id}
                pipelines={salesPipelinesList}
                stagesByPipeline={{}}
              />
            </div>
            <div>
              {(contracts ?? []).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '0.5px solid #f8f9fb' }}>
                  <div>
                    <Link href={`/contracts/${c.id}`} style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', textDecoration: 'none' }}>{c.title || c.process_number}</Link>
                    <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{Number(c.value) > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(c.value)) : '—'}</span>
                </div>
              ))}
              {(contracts ?? []).length === 0 && (
                <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#b0b8c8' }}>Nenhuma oportunidade vinculada ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Coluna lateral — Contatos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f1f3f8' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36', margin: 0 }}>Contatos ({(contacts ?? []).length})</p>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(contacts ?? []).map(c => (
                <div key={c.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#f8f9fb', border: '0.5px solid #f1f3f8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#1a1f36', margin: 0 }}>
                      {c.name} {c.is_primary && <span style={{ fontSize: 9, background: '#eef3ff', color: '#3b5bdb', padding: '1px 5px', borderRadius: 20 }}>Principal</span>}
                    </p>
                    <RemoveContactButton contactId={c.id} companyId={company.id} />
                  </div>
                  {c.role && <p style={{ fontSize: 11, color: '#8892a4', marginTop: 2 }}>{c.role}</p>}
                  {c.email && <p style={{ fontSize: 11, color: '#4f86f7', marginTop: 2 }}>{c.email}</p>}
                  {c.phone && <p style={{ fontSize: 11, color: '#8892a4', marginTop: 1 }}>{c.phone}</p>}
                </div>
              ))}
            </div>
            <div style={{ padding: '0 12px 12px' }}>
              <AddContactForm companyId={company.id} />
            </div>
          </div>

          {/* Notas */}
          {company.notes && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8edf5', padding: 16 }}>
              <p style={{ fontSize: 10, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>Observações</p>
              <p style={{ fontSize: 12, color: '#52514e', lineHeight: 1.5 }}>{company.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
