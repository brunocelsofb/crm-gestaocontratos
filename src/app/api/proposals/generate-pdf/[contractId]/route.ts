import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params

  // Verifica autenticação
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Busca dados
  const [{ data: contract }, { data: proposal }, { data: settings }] = await Promise.all([
    admin.from('contracts').select('client_name, title, process_number, cnpj').eq('id', contractId).maybeSingle(),
    admin.from('proposal_status').select('*').eq('contract_id', contractId).maybeSingle(),
    admin.from('company_settings').select('*').maybeSingle(),
  ])

  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

  const snapshot = proposal.technical_snapshot as any
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Gera HTML da proposta para converter em PDF via browser print
  // (Next.js não tem acesso ao reportlab — usamos HTML com print CSS)
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Proposta — ${contract?.client_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1f36; background: #fff; }
  @page { size: A4; margin: 0; }
  @media print {
    .no-print { display: none; }
    .page-break { page-break-after: always; }
  }

  /* Capa */
  .cover { 
    background: linear-gradient(135deg, #1b556b 0%, #32af9d 100%);
    min-height: 100vh; display: flex; flex-direction: column;
    justify-content: space-between; padding: 60px 64px;
    page-break-after: always;
  }
  .cover-logo { font-size: 24px; font-weight: 700; color: #fff; opacity: 0.9; }
  .cover-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .cover-tag { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; }
  .cover-title { font-size: 36px; font-weight: 300; color: #fff; line-height: 1.2; margin-bottom: 12px; }
  .cover-subtitle { font-size: 16px; color: rgba(255,255,255,0.8); margin-bottom: 48px; }
  .cover-pills { display: flex; gap: 16px; flex-wrap: wrap; }
  .cover-pill { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 100px; padding: 8px 20px; font-size: 13px; color: #fff; }
  .cover-footer { font-size: 11px; color: rgba(255,255,255,0.5); }

  /* Conteúdo */
  .content { padding: 56px 64px; }
  .section { margin-bottom: 48px; }
  .section-title { font-size: 13px; font-weight: 600; color: #8892a4; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #e8edf5; }
  
  /* Cards de KPI */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .kpi-card { background: #f8f9fb; border-radius: 10px; padding: 16px; }
  .kpi-label { font-size: 10px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
  .kpi-value { font-size: 24px; font-weight: 600; color: #1a1f36; }
  .kpi-card.highlight { background: #eef3ff; }
  .kpi-card.highlight .kpi-value { color: #3b5bdb; }
  .kpi-card.success { background: #eaf5ee; }
  .kpi-card.success .kpi-value { color: #1a7c3e; }

  /* Tabela */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #8892a4; font-weight: 500; border-bottom: 1px solid #e8edf5; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f3f8; color: #1a1f36; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; }
  .badge-blue { background: #eef3ff; color: #3b5bdb; }
  .badge-gray { background: #f1f3f8; color: #52514e; }

  /* Escopo */
  .escopo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .escopo-item { background: #eaf5ee; color: #1a7c3e; border: 1px solid #bbddc8; border-radius: 20px; padding: 6px 16px; font-size: 13px; }

  /* Valor */
  .value-box { background: linear-gradient(135deg, #1a1f36, #2d3561); border-radius: 12px; padding: 24px 28px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .value-label { font-size: 13px; color: rgba(255,255,255,0.7); }
  .value-amount { font-size: 28px; font-weight: 600; color: #32af9d; }

  /* Validade */
  .validity-box { background: #f8f9fb; border-radius: 10px; padding: 16px 20px; display: flex; gap: 24px; }
  .validity-item { }
  .validity-label { font-size: 10px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
  .validity-value { font-size: 14px; font-weight: 500; color: #1a1f36; }

  /* Histórico */
  .audit-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f3f8; }
  .audit-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .audit-body .audit-label { font-size: 13px; font-weight: 500; color: #1a1f36; }
  .audit-body .audit-meta { font-size: 11px; color: #8892a4; margin-top: 2px; }

  /* Fechamento */
  .closing { background: linear-gradient(135deg, #1b556b, #32af9d); padding: 56px 64px; page-break-before: always; min-height: 50vh; border-radius: 0; }
  .closing-title { font-size: 24px; font-weight: 300; color: #fff; margin-bottom: 12px; }
  .closing-text { font-size: 14px; color: rgba(255,255,255,0.8); line-height: 1.6; max-width: 520px; margin-bottom: 32px; }
  .closing-company { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px; }
  .closing-contact { font-size: 13px; color: rgba(255,255,255,0.7); }

  /* Print button */
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #1b556b; color: #fff; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; z-index: 999; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">⬇ Baixar PDF</button>

<!-- CAPA -->
<div class="cover">
  <div class="cover-logo">${settings?.company_name ?? 'ORBIS Engenharia'}</div>
  <div class="cover-content">
    <div class="cover-tag">Proposta Técnica e Comercial</div>
    <h1 class="cover-title">${contract?.client_name ?? 'Cliente'}</h1>
    <p class="cover-subtitle">${contract?.title ?? contract?.process_number ?? ''}</p>
    <div class="cover-pills">
      ${snapshot?.tipoEngenharia ? `<span class="cover-pill">Engenharia ${snapshot.tipoEngenharia}</span>` : ''}
      ${snapshot?.hospitalBeds > 0 ? `<span class="cover-pill">${snapshot.hospitalBeds} leitos</span>` : ''}
      ${snapshot?.totalFTE > 0 ? `<span class="cover-pill">${snapshot.totalFTE} profissionais</span>` : ''}
    </div>
  </div>
  <div class="cover-footer">
    Gerado em ${fmtDate(new Date().toISOString())}
    ${contract?.cnpj ? ` · CNPJ: ${contract.cnpj}` : ''}
  </div>
</div>

<!-- CONTEÚDO -->
<div class="content">

  <!-- Dimensionamento -->
  ${snapshot?.dimensionamento ? `
  <div class="section">
    <div class="section-title">Dimensionamento</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total de equipamentos</div>
        <div class="kpi-value">${snapshot.dimensionamento.totalEquipamentos}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">FTE demandado</div>
        <div class="kpi-value">${snapshot.dimensionamento.fteDemandado}</div>
      </div>
      <div class="kpi-card success">
        <div class="kpi-label">FTE alocado</div>
        <div class="kpi-value">${snapshot.totalFTE}</div>
      </div>
    </div>
    <p style="font-size:12px;color:#8892a4">
      Demanda: ${snapshot.dimensionamento.horasMensaisDemandadas}h/mês · 
      Base: ${snapshot.dimensionamento.hhLiquidoMes}h líquidas/técnico (produtividade 70%, absenteísmo 10%)
    </p>
  </div>
  ` : ''}

  <!-- Inventário por família -->
  ${snapshot?.dimensionamento?.familias?.length > 0 ? `
  <div class="section">
    <div class="section-title">Inventário por Família de Equipamentos</div>
    <table>
      <thead><tr><th>Família</th><th style="text-align:right">Quantidade</th></tr></thead>
      <tbody>
        ${snapshot.dimensionamento.familias.map((f: any) => `
          <tr><td>${f.familia}</td><td style="text-align:right;font-weight:500">${f.qty}</td></tr>
        `).join('')}
        <tr style="border-top:1px solid #e8edf5">
          <td style="font-weight:600">Total</td>
          <td style="text-align:right;font-weight:600">${snapshot.dimensionamento.totalEquipamentos}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Equipe -->
  ${snapshot?.professionals?.length > 0 ? `
  <div class="section">
    <div class="section-title">Equipe do Projeto</div>
    <table>
      <thead><tr><th>Função</th><th>Qtd</th><th>Regime</th><th>Carga horária</th></tr></thead>
      <tbody>
        ${snapshot.professionals.filter((p: any) => p.role?.trim()).map((p: any) => `
          <tr>
            <td>${p.role}</td>
            <td>${p.quantity}</td>
            <td><span class="badge ${p.contractType === 'CLT' ? 'badge-blue' : 'badge-gray'}">${p.contractType}</span></td>
            <td>${p.hoursPerMonth ? `${p.hoursPerMonth}h/mês` : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- Escopo -->
  ${(snapshot?.dimensionamento?.escopo ?? snapshot?.escopoServicos)?.length > 0 ? `
  <div class="section">
    <div class="section-title">Escopo de Serviços</div>
    <div class="escopo-grid">
      ${(snapshot?.dimensionamento?.escopo ?? snapshot?.escopoServicos ?? []).map((s: string) => `
        <span class="escopo-item">✓ ${s}</span>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Valor e validade -->
  <div class="section">
    <div class="section-title">Investimento</div>
    ${proposal.proposal_value ? `
    <div class="value-box">
      <div class="value-label">Investimento mensal</div>
      <div class="value-amount">${fmt(Number(proposal.proposal_value))}/mês</div>
    </div>
    ` : ''}
    <div class="validity-box">
      <div class="validity-item">
        <div class="validity-label">Validade da proposta</div>
        <div class="validity-value">${proposal.proposal_validity_days ?? 30} dias</div>
      </div>
      <div class="validity-item">
        <div class="validity-label">Data de emissão</div>
        <div class="validity-value">${fmtDate(new Date().toISOString())}</div>
      </div>
      <div class="validity-item">
        <div class="validity-label">Válida até</div>
        <div class="validity-value">${fmtDate(new Date(Date.now() + (proposal.proposal_validity_days ?? 30) * 86400000).toISOString())}</div>
      </div>
    </div>
  </div>

  <!-- Histórico de aprovações -->
  <div class="section">
    <div class="section-title">Histórico de Aprovações Internas</div>
    ${proposal.submitted_by_name ? `
    <div class="audit-item">
      <div class="audit-icon" style="background:#f8f9fb">📤</div>
      <div class="audit-body">
        <div class="audit-label">Enviada para aprovação técnica</div>
        <div class="audit-meta">por ${proposal.submitted_by_name}${proposal.submitted_at ? ` · ${fmtDate(proposal.submitted_at)}` : ''}</div>
      </div>
    </div>` : ''}
    ${proposal.technical_approved_by_name ? `
    <div class="audit-item">
      <div class="audit-icon" style="background:#eef3ff">🔧</div>
      <div class="audit-body">
        <div class="audit-label">Aprovada tecnicamente</div>
        <div class="audit-meta">por ${proposal.technical_approved_by_name}${proposal.technical_approved_at ? ` · ${fmtDate(proposal.technical_approved_at)}` : ''}</div>
        ${proposal.technical_comment ? `<div class="audit-meta" style="margin-top:4px;color:#52514e">"${proposal.technical_comment}"</div>` : ''}
      </div>
    </div>` : ''}
    ${proposal.commercial_approved_by_name ? `
    <div class="audit-item">
      <div class="audit-icon" style="background:#eaf5ee">✅</div>
      <div class="audit-body">
        <div class="audit-label">Aprovada comercialmente</div>
        <div class="audit-meta">por ${proposal.commercial_approved_by_name}${proposal.commercial_approved_at ? ` · ${fmtDate(proposal.commercial_approved_at)}` : ''}</div>
      </div>
    </div>` : ''}
  </div>

</div>

<!-- FECHAMENTO -->
<div class="closing">
  <p class="closing-title">Obrigado pela oportunidade.</p>
  <p class="closing-text">
    Estamos à disposição para esclarecer qualquer dúvida sobre esta proposta. 
    Nossa equipe está preparada para iniciar os trabalhos assim que recebermos sua confirmação.
  </p>
  <div class="closing-company">${settings?.company_name ?? 'ORBIS Engenharia'}</div>
  ${settings?.company_email ? `<div class="closing-contact">${settings.company_email}</div>` : ''}
  ${settings?.company_phone ? `<div class="closing-contact">${settings.company_phone}</div>` : ''}
</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    }
  })
}
