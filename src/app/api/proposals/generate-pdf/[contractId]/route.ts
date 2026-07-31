import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: contract }, { data: proposal }, { data: templates }] = await Promise.all([
    admin.from('contracts').select('client_name, title, process_number, cnpj').eq('id', contractId).maybeSingle(),
    admin.from('proposal_status').select('*').eq('contract_id', contractId).maybeSingle(),
    admin.from('proposal_templates').select('*').order('name').limit(1),
  ])

  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })

  const snapshot = proposal.technical_snapshot as any
  const template = templates?.[0]
  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const fmtDateTime = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Busca URL pública do template de capa se existir
  let capaUrl = ''
  if (template?.file_storage_path) {
    const { data } = admin.storage.from('proposal-files').getPublicUrl(template.file_storage_path)
    capaUrl = data.publicUrl
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Proposta — ${contract?.client_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1f36; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 0; }
  @media print { .no-print { display: none !important; } }

  .page { width: 210mm; min-height: 297mm; page-break-after: always; position: relative; overflow: hidden; }
  .page:last-child { page-break-after: avoid; }

  /* CAPA EMBED */
  .cover-embed { width: 210mm; height: 297mm; }
  .cover-embed iframe { width: 100%; height: 100%; border: none; }

  /* CAPA FALLBACK */
  .cover-fallback {
    background: linear-gradient(155deg, #1b556b 0%, #1a7c6b 50%, #32af9d 100%);
    width: 210mm; height: 297mm;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 60px 56px; color: #fff;
  }
  .cf-logo { font-size: 22px; font-weight: 700; opacity: 0.9; letter-spacing: -0.5px; }
  .cf-tag { font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; opacity: 0.6; margin-bottom: 14px; }
  .cf-name { font-size: 38px; font-weight: 300; line-height: 1.15; margin-bottom: 10px; }
  .cf-sub { font-size: 16px; opacity: 0.75; margin-bottom: 48px; }
  .cf-pills { display: flex; flex-wrap: wrap; gap: 10px; }
  .cf-pill { background: rgba(255,255,255,0.15); border: 0.5px solid rgba(255,255,255,0.35); border-radius: 100px; padding: 7px 18px; font-size: 12px; }
  .cf-footer { font-size: 10px; opacity: 0.45; }

  /* MIOLO */
  .body-page { padding: 52px 56px; width: 210mm; min-height: 297mm; }
  .section { margin-bottom: 36px; }
  .section-title { font-size: 9px; font-weight: 700; color: #8892a4; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 0.5px solid #e8edf5; }

  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
  .kpi { background: #f8f9fb; border-radius: 8px; padding: 12px 14px; }
  .kpi.blue { background: #eef3ff; }
  .kpi.green { background: #eaf5ee; }
  .kpi-l { font-size: 8px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
  .kpi-v { font-size: 22px; font-weight: 700; color: #1a1f36; }
  .kpi.blue .kpi-v { color: #3b5bdb; }
  .kpi.green .kpi-v { color: #1a7c3e; }
  .kpi-note { font-size: 10px; color: #8892a4; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 7px 10px; color: #8892a4; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 0.5px solid #e8edf5; }
  td { padding: 8px 10px; border-bottom: 0.5px solid #f1f3f8; color: #1a1f36; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 20px; font-size: 9px; font-weight: 500; }
  .badge-blue { background: #eef3ff; color: #3b5bdb; }
  .badge-gray { background: #f1f3f8; color: #52514e; }
  .total-row td { font-weight: 700; background: #f8f9fb; border-top: 1px solid #e8edf5 !important; }

  .escopo { display: flex; flex-wrap: wrap; gap: 6px; }
  .escopo-item { background: #eaf5ee; color: #1a7c3e; border: 0.5px solid #bbddc8; border-radius: 20px; padding: 5px 14px; font-size: 11px; }

  .value-box { background: linear-gradient(135deg, #1a1f36 0%, #2d3561 100%); border-radius: 10px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .value-label { font-size: 11px; color: rgba(255,255,255,0.65); }
  .value-amount { font-size: 26px; font-weight: 700; color: #32af9d; }

  .validity-row { display: flex; gap: 0; background: #f8f9fb; border-radius: 8px; overflow: hidden; }
  .validity-cell { flex: 1; padding: 12px 16px; border-right: 0.5px solid #e8edf5; }
  .validity-cell:last-child { border-right: none; }
  .validity-l { font-size: 8px; color: #8892a4; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
  .validity-v { font-size: 13px; font-weight: 600; color: #1a1f36; }

  .audit { border: 0.5px solid #e8edf5; border-radius: 8px; overflow: hidden; }
  .audit-row { display: flex; gap: 14px; padding: 12px 16px; border-bottom: 0.5px solid #f1f3f8; align-items: flex-start; }
  .audit-row:last-child { border-bottom: none; }
  .audit-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .audit-label { font-size: 12px; font-weight: 600; color: #1a1f36; margin-bottom: 2px; }
  .audit-meta { font-size: 10px; color: #8892a4; }
  .audit-comment { font-size: 10px; color: #52514e; margin-top: 4px; font-style: italic; }

  /* FECHAMENTO */
  .closing-page {
    background: linear-gradient(155deg, #1b556b 0%, #32af9d 100%);
    width: 210mm; min-height: 148mm;
    padding: 52px 56px; color: #fff;
    display: flex; flex-direction: column; justify-content: center;
  }
  .closing-title { font-size: 28px; font-weight: 300; margin-bottom: 16px; }
  .closing-text { font-size: 13px; line-height: 1.7; opacity: 0.8; max-width: 480px; margin-bottom: 32px; }
  .closing-co { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .closing-contact { font-size: 12px; opacity: 0.65; }

  /* Print button */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; height: 52px; background: #1a1f36; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; z-index: 999; }
  .print-bar-title { font-size: 13px; color: rgba(255,255,255,0.7); }
  .print-btn { padding: 8px 20px; background: #32af9d; color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; }
  @media print { .print-bar { display: none; } body { padding-top: 0; } }
  body { padding-top: 52px; }
  @media print { body { padding-top: 0; } }
</style>
</head>
<body>

<div class="print-bar no-print">
  <span class="print-bar-title">Proposta — ${contract?.client_name ?? ''}</span>
  <button class="print-btn" onclick="window.print()">⬇ Salvar como PDF</button>
</div>

<!-- CAPA -->
<div class="page">
  ${capaUrl
    ? `<img src="${capaUrl}" style="width:210mm;height:297mm;object-fit:cover;display:block" />`
    : `<div class="cover-fallback">
        <div class="cf-logo">ORBIS Engenharia</div>
        <div>
          <div class="cf-tag">Proposta Técnica e Comercial</div>
          <div class="cf-name">${contract?.client_name ?? 'Cliente'}</div>
          <div class="cf-sub">${contract?.title ?? contract?.process_number ?? ''}</div>
          <div class="cf-pills">
            ${snapshot?.tipoEngenharia ? `<span class="cf-pill">Engenharia ${snapshot.tipoEngenharia}</span>` : ''}
            ${snapshot?.hospitalBeds > 0 ? `<span class="cf-pill">${snapshot.hospitalBeds} leitos</span>` : ''}
            ${snapshot?.totalFTE > 0 ? `<span class="cf-pill">${snapshot.totalFTE} profissionais</span>` : ''}
          </div>
        </div>
        <div class="cf-footer">Emitido em ${fmtDate(new Date().toISOString())}${contract?.cnpj ? ` · CNPJ: ${contract.cnpj}` : ''}</div>
      </div>`
  }
</div>

<!-- MIOLO — Dimensionamento e Inventário -->
<div class="page">
  <div class="body-page">

    ${snapshot?.dimensionamento ? `
    <div class="section">
      <div class="section-title">Dimensionamento</div>
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-l">Equipamentos</div>
          <div class="kpi-v">${snapshot.dimensionamento.totalEquipamentos}</div>
        </div>
        <div class="kpi blue">
          <div class="kpi-l">FTE Demandado</div>
          <div class="kpi-v">${snapshot.dimensionamento.fteDemandado}</div>
        </div>
        <div class="kpi green">
          <div class="kpi-l">FTE Alocado</div>
          <div class="kpi-v">${snapshot.totalFTE}</div>
        </div>
      </div>
      <div class="kpi-note">
        Demanda: ${snapshot.dimensionamento.horasMensaisDemandadas}h/mês · Base: ${snapshot.dimensionamento.hhLiquidoMes}h líquidas/técnico (produtividade 70%, absenteísmo 10%)
      </div>
    </div>` : ''}

    ${snapshot?.dimensionamento?.familias?.length > 0 ? `
    <div class="section">
      <div class="section-title">Inventário por Família de Equipamentos</div>
      <table>
        <thead><tr><th>Família</th><th style="text-align:right">Quantidade</th></tr></thead>
        <tbody>
          ${snapshot.dimensionamento.familias.map((f: any) => `
            <tr><td>${f.familia}</td><td style="text-align:right;font-weight:600">${f.qty}</td></tr>
          `).join('')}
          <tr class="total-row"><td>Total inventariado</td><td style="text-align:right">${snapshot.dimensionamento.totalEquipamentos}</td></tr>
        </tbody>
      </table>
    </div>` : ''}

  </div>
</div>

<!-- MIOLO — Equipe e Escopo -->
<div class="page">
  <div class="body-page">

    ${snapshot?.professionals?.filter((p: any) => p.role?.trim()).length > 0 ? `
    <div class="section">
      <div class="section-title">Equipe do Projeto</div>
      <div class="kpi-row" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="kpi"><div class="kpi-l">Total</div><div class="kpi-v">${snapshot.totalFTE}</div></div>
        ${snapshot.cltCount > 0 ? `<div class="kpi blue"><div class="kpi-l">CLT</div><div class="kpi-v">${snapshot.cltCount}</div></div>` : ''}
        ${snapshot.pjCount > 0 ? `<div class="kpi"><div class="kpi-l">PJ</div><div class="kpi-v">${snapshot.pjCount}</div></div>` : ''}
      </div>
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
    </div>` : ''}

    ${(snapshot?.dimensionamento?.escopo ?? snapshot?.escopoServicos)?.length > 0 ? `
    <div class="section">
      <div class="section-title">Escopo de Serviços</div>
      <div class="escopo">
        ${(snapshot?.dimensionamento?.escopo ?? snapshot?.escopoServicos ?? []).map((s: string) => `
          <span class="escopo-item">✓ ${s}</span>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- Investimento -->
    <div class="section">
      <div class="section-title">Investimento</div>
      ${proposal.proposal_value ? `
      <div class="value-box">
        <div class="value-label">Investimento mensal</div>
        <div class="value-amount">${fmt(Number(proposal.proposal_value))}/mês</div>
      </div>` : ''}
      <div class="validity-row">
        <div class="validity-cell"><div class="validity-l">Validade</div><div class="validity-v">${proposal.proposal_validity_days ?? 30} dias</div></div>
        <div class="validity-cell"><div class="validity-l">Emissão</div><div class="validity-v">${fmtDate(new Date().toISOString())}</div></div>
        <div class="validity-cell"><div class="validity-l">Válida até</div><div class="validity-v">${fmtDate(new Date(Date.now() + (proposal.proposal_validity_days ?? 30) * 86400000).toISOString())}</div></div>
      </div>
    </div>

    <!-- Histórico de aprovações -->
    ${proposal.submitted_by_name || proposal.technical_approved_by_name || proposal.commercial_approved_by_name ? `
    <div class="section">
      <div class="section-title">Aprovações Internas</div>
      <div class="audit">
        ${proposal.submitted_by_name ? `
        <div class="audit-row">
          <div class="audit-icon" style="background:#f8f9fb">📤</div>
          <div><div class="audit-label">Enviada para aprovação técnica</div><div class="audit-meta">por ${proposal.submitted_by_name}${proposal.submitted_at ? ` · ${fmtDateTime(proposal.submitted_at)}` : ''}</div></div>
        </div>` : ''}
        ${proposal.technical_approved_by_name ? `
        <div class="audit-row">
          <div class="audit-icon" style="background:#eef3ff">🔧</div>
          <div>
            <div class="audit-label">Aprovada tecnicamente</div>
            <div class="audit-meta">por ${proposal.technical_approved_by_name}${proposal.technical_approved_at ? ` · ${fmtDateTime(proposal.technical_approved_at)}` : ''}</div>
            ${proposal.technical_comment ? `<div class="audit-comment">"${proposal.technical_comment}"</div>` : ''}
          </div>
        </div>` : ''}
        ${proposal.commercial_approved_by_name ? `
        <div class="audit-row">
          <div class="audit-icon" style="background:#eaf5ee">✅</div>
          <div><div class="audit-label">Aprovada comercialmente</div><div class="audit-meta">por ${proposal.commercial_approved_by_name}${proposal.commercial_approved_at ? ` · ${fmtDateTime(proposal.commercial_approved_at)}` : ''}</div></div>
        </div>` : ''}
      </div>
    </div>` : ''}

  </div>
</div>

<!-- FECHAMENTO -->
<div class="page">
  <div class="closing-page">
    <div class="closing-title">Obrigado pela oportunidade.</div>
    <div class="closing-text">
      Estamos à disposição para esclarecer qualquer dúvida sobre esta proposta. 
      Nossa equipe técnica e comercial está pronta para iniciar os trabalhos 
      assim que recebermos sua confirmação.
    </div>
    <div class="closing-co">ORBIS Engenharia Clínica e Hospitalar</div>
    <div class="closing-contact">contato@orbisengenharia.com.br</div>
  </div>
</div>

</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
