import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Paleta de cores
const TEAL  = rgb(0.11, 0.34, 0.42)  // #1b556b
const MINT  = rgb(0.20, 0.69, 0.62)  // #32af9d
const DARK  = rgb(0.10, 0.12, 0.21)  // #1a1f36
const GRAY  = rgb(0.53, 0.54, 0.64)  // #8892a4
const WHITE = rgb(1, 1, 1)
const LIGHT = rgb(0.97, 0.98, 0.98)
const GREEN = rgb(0.10, 0.49, 0.24)  // #1a7c3e
const BLUE  = rgb(0.23, 0.36, 0.86)  // #3b5bdb
const ORANGE = rgb(1.0, 0.40, 0.00)  // #FF6600

function sanitize(s: string | null | undefined): string {
  if (!s) return ''
  const map: Record<string, string> = {
    '\u00e1':'a','\u00e0':'a','\u00e3':'a','\u00e2':'a','\u00e4':'a',
    '\u00c1':'A','\u00c0':'A','\u00c3':'A','\u00c2':'A',
    '\u00e9':'e','\u00e8':'e','\u00ea':'e','\u00eb':'e',
    '\u00c9':'E','\u00c8':'E','\u00ca':'E',
    '\u00ed':'i','\u00ec':'i','\u00ee':'i','\u00ef':'i','\u00cd':'I',
    '\u00f3':'o','\u00f2':'o','\u00f5':'o','\u00f4':'o','\u00f6':'o',
    '\u00d3':'O','\u00d4':'O','\u00d5':'O',
    '\u00fa':'u','\u00f9':'u','\u00fb':'u','\u00fc':'u','\u00da':'U',
    '\u00e7':'c','\u00c7':'C','\u00f1':'n','\u00d1':'N',
    '\u2019':"'",'`':"'",'\'':'\''
  }
  return Array.from(s).map(c => map[c] ?? (c.charCodeAt(0) > 127 ? '' : c)).join('')
}

function fmt(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function buildPriceProposalPage(params: {
  snapshot: any
  proposalValue: number
  validityDays: number
  submittedByName: string | null
  technicalApprovedByName: string | null
  technicalApprovedAt: string | null
  technicalComment: string | null
  commercialApprovedByName: string | null
  commercialApprovedAt: string | null
  contract: { client_name: string; process_number: string | null; cnpj: string | null } | null
}): Promise<Uint8Array> {
  const { snapshot, proposalValue, validityDays, contract } = params
  const s = snapshot

  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const W = 595.28, H = 841.89
  const ml = 44, mr = 44

  function newPage() {
    const page = pdfDoc.addPage([W, H])
    // Header teal
    page.drawRectangle({ x: 0, y: H - 44, width: W, height: 44, color: TEAL })
    page.drawText(sanitize(contract?.client_name ?? s.clientName), { x: ml, y: H - 16, size: 10, font: bold, color: WHITE })
    page.drawText(sanitize(s.projectName ?? ''), { x: ml, y: H - 30, size: 8, font: reg, color: rgb(0.7, 0.85, 0.85) })
    page.drawText('ORBIS Engenharia', { x: W - mr - 90, y: H - 28, size: 7, font: bold, color: rgb(0.7, 0.85, 0.85) })
    return { page, y: H - 60 }
  }

  function secTitle(page: any, label: string, y: number) {
    page.drawRectangle({ x: ml, y: y - 14, width: W - ml - mr, height: 16, color: rgb(0.95, 0.97, 0.97) })
    page.drawText(sanitize(label), { x: ml + 6, y: y - 10, size: 7, font: bold, color: TEAL })
    return y - 24
  }

  function kpiBox(page: any, x: number, y: number, w: number, label: string, value: string, bg: any, fg: any) {
    page.drawRectangle({ x, y: y - 36, width: w, height: 36, color: bg })
    page.drawText(sanitize(label), { x: x + 6, y: y - 12, size: 7, font: reg, color: GRAY })
    page.drawText(sanitize(value), { x: x + 6, y: y - 28, size: 14, font: bold, color: fg })
  }

  // ── PÁGINA 1: Escopo + Equipamentos + Equipe ────────────────────────────
  {
    const { page, y: yStart } = newPage()
    let y = yStart

    // Objeto do contrato
    if (s.objetoContrato) {
      y = secTitle(page, 'OBJETO DO CONTRATO', y)
      const obj = sanitize(s.objetoContrato)
      page.drawText(obj.slice(0, 100), { x: ml, y, size: 9, font: reg, color: DARK })
      if (obj.length > 100) page.drawText(obj.slice(100, 200), { x: ml, y: y - 12, size: 9, font: reg, color: DARK })
      y -= obj.length > 100 ? 30 : 18
    }

    // Escopo
    y = secTitle(page, 'ESCOPO DO CONTRATO', y)
    const escopo: string[] = s.escopoSanitizado ?? s.escopoServicos ?? []
    const col2Start = ml + (W - ml - mr) / 2 + 4
    escopo.forEach((item: string, i: number) => {
      const x = i % 2 === 0 ? ml : col2Start
      const yPos = y - Math.floor(i / 2) * 14
      page.drawText('-', { x, y: yPos, size: 8, font: bold, color: TEAL })
      page.drawText(sanitize(item), { x: x + 10, y: yPos, size: 8, font: reg, color: DARK })
    })
    y -= (Math.ceil(escopo.length / 2)) * 14 + 10

    // Equipamentos
    if (s.equipamentos?.total > 0) {
      y = secTitle(page, 'EQUIPAMENTOS GERENCIADOS', y)
      const eq = s.equipamentos
      kpiBox(page, ml, y, 120, 'Total de Equipamentos', String(eq.total), LIGHT, DARK)
      let xOff = ml + 128
      if (eq.proprios > 0)   { kpiBox(page, xOff, y, 80, 'Proprios',   String(eq.proprios),   rgb(0.93,0.96,0.93), GREEN); xOff += 88 }
      if (eq.locados > 0)    { kpiBox(page, xOff, y, 80, 'Locados',    String(eq.locados),    LIGHT, DARK); xOff += 88 }
      if (eq.comodatos > 0)  { kpiBox(page, xOff, y, 80, 'Comodatados',String(eq.comodatos),  LIGHT, DARK); xOff += 88 }
      y -= 48
    } else if (s.dimensionamento?.totalEquipamentos > 0) {
      y = secTitle(page, 'EQUIPAMENTOS GERENCIADOS', y)
      kpiBox(page, ml, y, 150, 'Total de Equipamentos', String(s.dimensionamento.totalEquipamentos), LIGHT, DARK)
      if (s.dimensionamento.fteDemandado > 0) {
        kpiBox(page, ml + 158, y, 120, 'FTE Demandado', String(s.dimensionamento.fteDemandado), rgb(0.93,0.95,1), BLUE)
      }
      y -= 48
    }

    // Equipe
    y = secTitle(page, 'EQUIPE DO PROJETO', y)
    const profs = (s.professionals ?? []).filter((p: any) => p.role?.trim())
    const totalEquipe = s.totalFTE ?? profs.reduce((acc: number, p: any) => acc + p.quantity, 0)

    // KPIs equipe
    kpiBox(page, ml, y, 100, 'Total', String(totalEquipe), LIGHT, DARK)
    if ((s.gestores ?? 0) > 0) kpiBox(page, ml + 108, y, 80, 'Gestores', String(s.gestores), rgb(0.93,0.95,1), BLUE)
    if ((s.tecnicosDiurno ?? 0) > 0) kpiBox(page, ml + 196, y, 80, 'Diurno', String(s.tecnicosDiurno), LIGHT, DARK)
    if ((s.tecnicosNoturno ?? 0) > 0) kpiBox(page, ml + 284, y, 80, 'Noturno', String(s.tecnicosNoturno), LIGHT, DARK)
    if (s.cltCount > 0) kpiBox(page, ml + 372, y, 60, 'CLT', String(s.cltCount), rgb(0.93,0.95,1), BLUE)
    if (s.pjCount > 0)  kpiBox(page, ml + 440, y, 60, 'PJ', String(s.pjCount), LIGHT, DARK)
    y -= 46

    // Tabela de profissionais
    page.drawRectangle({ x: ml, y: y - 14, width: W - ml - mr, height: 14, color: TEAL })
    ;['Funcao', 'Qtd', 'Regime', 'Carga'].forEach((h, i) => {
      const xs = [ml + 4, ml + 240, ml + 290, ml + 360]
      page.drawText(h, { x: xs[i], y: y - 10, size: 6, font: bold, color: WHITE })
    })
    y -= 14

    profs.forEach((p: any, i: number) => {
      if (i % 2 === 0) page.drawRectangle({ x: ml, y: y - 12, width: W - ml - mr, height: 12, color: LIGHT })
      page.drawText(sanitize(p.role), { x: ml + 4, y: y - 9, size: 8, font: reg, color: DARK })
      page.drawText(String(p.quantity), { x: ml + 240, y: y - 9, size: 8, font: bold, color: DARK })
      page.drawText(sanitize(p.contractType), { x: ml + 290, y: y - 9, size: 8, font: reg, color: p.contractType === 'CLT' ? BLUE : DARK })
      page.drawText(p.hoursPerMonth ? `${p.hoursPerMonth}h/mes` : '-', { x: ml + 360, y: y - 9, size: 8, font: reg, color: DARK })
      y -= 12
    })
    y -= 6
  }

  // ── PÁGINA 2: Dimensionamento + Investimento + Aprovações ──────────────
  {
    const { page, y: yStart } = newPage()
    let y = yStart

    // Dimensionamento (se Clínica)
    const dim = s.dimensionamento
    if (dim && dim.totalEquipamentos > 0) {
      y = secTitle(page, 'DIMENSIONAMENTO', y)
      kpiBox(page, ml,       y, 120, 'Equipamentos',       String(dim.totalEquipamentos),          LIGHT, DARK)
      kpiBox(page, ml + 128, y, 120, 'Horas/mes demandadas', `${dim.horasMensaisDemandadas}h`,     LIGHT, DARK)
      kpiBox(page, ml + 256, y, 100, 'FTE Demandado',       String(dim.fteDemandado),              rgb(0.93,0.95,1), BLUE)
      kpiBox(page, ml + 364, y, 100, 'FTE Alocado',         String(s.totalFTE),                    rgb(0.91,0.96,0.93), GREEN)
      y -= 46
      page.drawText(sanitize(`Base: ${dim.hhLiquidoMes}h liquidas/tecnico (produtividade 70%, absenteismo 10%)`), { x: ml, y, size: 7, font: reg, color: GRAY })
      y -= 18
    }

    // Inventário resumido
    if (dim?.familias?.length > 0) {
      y = secTitle(page, 'PRINCIPAIS FAMILIAS DE EQUIPAMENTOS', y)
      const top = dim.familias.slice(0, 10)
      const colW = (W - ml - mr - 8) / 2
      top.forEach((f: any, i: number) => {
        const x = i % 2 === 0 ? ml : ml + colW + 8
        const yPos = y - Math.floor(i / 2) * 12
        page.drawText(sanitize(f.familia), { x, y: yPos, size: 7.5, font: reg, color: DARK })
        page.drawText(String(f.qty), { x: x + colW - 20, y: yPos, size: 7.5, font: bold, color: TEAL })
      })
      y -= (Math.ceil(top.length / 2)) * 12 + 10
    }

    // Investimento
    y = secTitle(page, 'INVESTIMENTO', y)
    const dur = s.contractDuration ?? 24
    const valorTotal = proposalValue * dur

    page.drawRectangle({ x: ml, y: y - 48, width: W - ml - mr, height: 48, color: DARK })
    page.drawText('Investimento Mensal Global', { x: ml + 12, y: y - 16, size: 8, font: reg, color: rgb(0.7, 0.8, 0.85) })
    page.drawText(sanitize(fmt(proposalValue)), { x: ml + 12, y: y - 34, size: 18, font: bold, color: MINT })
    page.drawText(sanitize(`Contrato de ${dur} meses`), { x: W - mr - 150, y: y - 16, size: 7, font: reg, color: rgb(0.6, 0.75, 0.8) })
    page.drawText(sanitize(`Total: ${fmt(valorTotal)}`), { x: W - mr - 150, y: y - 30, size: 9, font: bold, color: rgb(0.85, 0.95, 0.9) })
    y -= 60

    // Validade
    const validDate = new Date(Date.now() + validityDays * 86400000)
    const colV = (W - ml - mr) / 3
    ;[
      { l: 'Validade da Proposta', v: `${validityDays} dias` },
      { l: 'Data de Emissao', v: fmtDate(new Date().toISOString()) },
      { l: 'Valida ate', v: fmtDate(validDate.toISOString()) },
    ].forEach((c, i) => {
      const x = ml + i * colV
      page.drawRectangle({ x, y: y - 30, width: colV - 4, height: 30, color: LIGHT })
      page.drawText(sanitize(c.l), { x: x + 6, y: y - 10, size: 7, font: reg, color: GRAY })
      page.drawText(sanitize(c.v), { x: x + 6, y: y - 22, size: 9, font: bold, color: DARK })
    })
    y -= 42

    // Itens da proposta
    y = secTitle(page, 'COMPOSICAO DA PROPOSTA', y)
    const itens = [
      { num: 'ITEM 1', titulo: s.tituloItemServico ?? 'Servico Continuo de Engenharia' },
      { num: 'ITEM 2', titulo: s.tituloItemPecas ?? 'Fornecimento de Pecas e Insumos' },
      { num: 'ITEM 3', titulo: s.tituloItemServicosExternos ?? 'Servicos Especializados sob Demanda' },
    ]
    itens.forEach((item, i) => {
      if (i % 2 === 0) page.drawRectangle({ x: ml, y: y - 14, width: W - ml - mr, height: 14, color: LIGHT })
      page.drawText(item.num, { x: ml + 4, y: y - 10, size: 7, font: bold, color: TEAL })
      page.drawText(sanitize(item.titulo), { x: ml + 50, y: y - 10, size: 8, font: reg, color: DARK })
      y -= 14
    })
    y -= 10

    // Aprovações internas
    const aprovacoes = [
      params.submittedByName && { label: 'Enviada para aprovacao tecnica', by: params.submittedByName, at: null },
      params.technicalApprovedByName && { label: 'Aprovada tecnicamente', by: params.technicalApprovedByName, at: params.technicalApprovedAt, comment: params.technicalComment },
      params.commercialApprovedByName && { label: 'Aprovada comercialmente', by: params.commercialApprovedByName, at: params.commercialApprovedAt },
    ].filter(Boolean) as any[]

    if (aprovacoes.length) {
      y = secTitle(page, 'APROVACOES INTERNAS', y)
      aprovacoes.forEach(a => {
        page.drawText(sanitize(a.label), { x: ml + 4, y, size: 8, font: bold, color: DARK })
        const meta = `por ${sanitize(a.by)}${a.at ? ` - ${fmtDate(a.at)}` : ''}`
        page.drawText(meta, { x: ml + 4, y: y - 12, size: 7, font: reg, color: GRAY })
        if (a.comment) {
          page.drawText(sanitize(`"${a.comment}"`), { x: ml + 4, y: y - 22, size: 7, font: reg, color: GRAY })
        }
        y -= a.comment ? 34 : 22
      })
    }
  }

  return pdfDoc.save()
}
