// Constrói o miolo da proposta usando os dados do snapshot do ORBIS Price
// Substitui o proposal-pdf-builder quando a proposta vem do fluxo Price→CRM
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

type Snapshot = {
  clientName: string
  projectName: string
  tipoEngenharia: string
  hospitalBeds: number
  escopoServicos: string[]
  professionals: { role: string; quantity: number; contractType: string; hoursPerMonth: number }[]
  totalFTE: number
  cltCount: number
  pjCount: number
  dimensionamento?: {
    totalEquipamentos: number
    horasMensaisDemandadas: number
    fteDemandado: number
    fteArredondado: number
    hhLiquidoMes: number
    familias: { familia: string; qty: number; horasMes: number }[]
    escopo: string[]
  }
  sentAt: string
}

const TEAL   = rgb(0.11, 0.34, 0.42) // #1b556b
const MINT   = rgb(0.20, 0.49, 0.62) // #32af9d  
const GRAY   = rgb(0.53, 0.54, 0.64) // #8892a4
const DARK   = rgb(0.10, 0.12, 0.21) // #1a1f36
const WHITE  = rgb(1, 1, 1)
const LIGHT  = rgb(0.97, 0.98, 0.98) // #f8f9fb

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}


function sanitize(s: string | null | undefined): string {
  if (!s) return ''
  const map: Record<string, string> = {
    'á':'a','à':'a','ã':'a','â':'a',
    'á':'a','à':'a','ã':'a','â':'a','ä':'a',
    'Á':'A','À':'A','Ã':'A','Â':'A',
    'é':'e','è':'e','ê':'e','ë':'e',
    'É':'E','È':'E','Ê':'E',
    'í':'i','ì':'i','î':'i','ï':'i','Í':'I',
    'ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
    'Ó':'O','Ô':'O','Õ':'O',
    'ú':'u','ù':'u','û':'u','ü':'u','Ú':'U',
    'ç':'c','Ç':'C','ñ':'n','Ñ':'N',
    '→':'>','─':'-','✓':'OK','✅':'OK',
  }
  return Array.from(s).map(c => map[c] ?? (c.charCodeAt(0) > 127 ? '' : c)).join('')
}

export async function buildPriceProposalPage(params: {
  snapshot: Snapshot
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
  const dim = snapshot.dimensionamento

  const pdfDoc = await PDFDocument.create()
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const W = 595.28, H = 841.89 // A4
  const ml = 48, mr = 48, mt = 40

  function addPage() {
    const page = pdfDoc.addPage([W, H])
    return { page, y: H - mt }
  }

  function text(page: any, t: string, x: number, y: number, size = 10, f = font, color = DARK) {
    page.drawText(String(t ?? ''), { x, y, size, font: f, color })
  }

  function line(page: any, y: number) {
    page.drawLine({ start: { x: ml, y }, end: { x: W - mr, y }, thickness: 0.3, color: rgb(0.91, 0.93, 0.96) })
  }

  function rect(page: any, x: number, y: number, w: number, h: number, color: any) {
    page.drawRectangle({ x, y: y - h, width: w, height: h, color })
  }

  // ── PÁGINA 1: Dimensionamento e Inventário ─────────────────────────────
  {
    const { page, y: yStart } = addPage()
    let y = yStart

    // Header
    rect(page, 0, H, W, 44, TEAL)
    text(page, sanitize('PROPOSTA TÉCNICA E COMERCIAL'), ml, H - 16, 8, boldFont, WHITE)
    text(page, sanitize(`${contract?.client_name ?? snapshot.clientName}  ·  ${snapshot.projectName}`), ml, H - 28, 10, boldFont, WHITE)
    text(page, sanitize(`Emitido em ${fmtDate(new Date().toISOString())}`), W - mr - 100, H - 28, 7, font, rgb(0.8, 0.9, 0.9))
    y -= 60

    // Seção: Dimensionamento
    if (dim) {
      text(page, sanitize('DIMENSIONAMENTO'), ml, y, 7, boldFont, GRAY)
      line(page, y - 4)
      y -= 20

      // KPIs
      const kpiW = (W - ml - mr - 16) / 3
      const cards = [
        { label: 'Equipamentos', value: String(dim.totalEquipamentos), bg: LIGHT },
        { label: 'FTE Demandado', value: String(dim.fteDemandado), bg: rgb(0.93, 0.95, 1) },
        { label: 'FTE Alocado', value: String(snapshot.totalFTE), bg: rgb(0.91, 0.96, 0.93) },
      ]
      cards.forEach((c, i) => {
        const x = ml + i * (kpiW + 8)
        rect(page, x, y, kpiW, 44, c.bg)
        text(page, sanitize(c.label), x + 8, y - 12, 7, font, GRAY)
        text(page, sanitize(c.value), x + 8, y - 28, 18, boldFont, DARK)
      })
      y -= 56
      text(page, sanitize(`Demanda: ${dim.horasMensaisDemandadas}h/mes  Base: ${dim.hhLiquidoMes}h liq/tecnico (prod 70%, absent 10%)`), ml, y, 7, font, GRAY)
      y -= 28
    }

    // Seção: Inventário por família
    if (dim?.familias?.length) {
      text(page, sanitize('INVENTÁRIO POR FAMÍLIA DE EQUIPAMENTOS'), ml, y, 7, boldFont, GRAY)
      line(page, y - 4)
      y -= 18

      // Header tabela
      rect(page, ml, y, W - ml - mr, 16, TEAL)
      text(page, sanitize('Família'), ml + 8, y - 11, 7, boldFont, WHITE)
      text(page, sanitize('Quantidade'), W - mr - 60, y - 11, 7, boldFont, WHITE)
      y -= 16

      dim.familias.forEach((f, i) => {
        if (y < 80) return // evita overflow
        if (i % 2 === 0) rect(page, ml, y, W - ml - mr, 14, LIGHT)
        text(page, sanitize(f.familia), ml + 8, y - 10, 8, font, DARK)
        text(page, String(f.qty), W - mr - 40, y - 10, 8, font, DARK)
        y -= 14
      })

      // Total
      rect(page, ml, y, W - ml - mr, 16, rgb(0.94, 0.96, 0.94))
      text(page, sanitize('Total inventariado'), ml + 8, y - 11, 8, boldFont, DARK)
      text(page, String(dim.totalEquipamentos), W - mr - 40, y - 11, 8, boldFont, DARK)
      y -= 24
    }
  }

  // ── PÁGINA 2: Equipe + Escopo + Investimento + Aprovações ──────────────
  {
    const { page, y: yStart } = addPage()
    let y = yStart

    // Header
    rect(page, 0, H, W, 44, TEAL)
    text(page, sanitize('PROPOSTA TÉCNICA E COMERCIAL'), ml, H - 16, 8, boldFont, WHITE)
    text(page, sanitize(`${contract?.client_name ?? snapshot.clientName}`), ml, H - 28, 10, boldFont, WHITE)
    y -= 60

    // Equipe
    const profs = snapshot.professionals.filter(p => p.role?.trim())
    if (profs.length) {
      text(page, sanitize('EQUIPE DO PROJETO'), ml, y, 7, boldFont, GRAY)
      line(page, y - 4)
      y -= 18

      // KPIs equipe
      const ew = (W - ml - mr - 16) / 3
      ;[
        { label: 'Total', value: String(snapshot.totalFTE), bg: LIGHT },
        { label: 'CLT', value: String(snapshot.cltCount), bg: rgb(0.93, 0.95, 1) },
        { label: 'PJ', value: String(snapshot.pjCount), bg: LIGHT },
      ].forEach((c, i) => {
        const x = ml + i * (ew + 8)
        rect(page, x, y, ew, 36, c.bg)
        text(page, sanitize(c.label), x + 8, y - 10, 7, font, GRAY)
        text(page, sanitize(c.value), x + 8, y - 24, 16, boldFont, DARK)
      })
      y -= 46

      // Header tabela
      rect(page, ml, y, W - ml - mr, 16, TEAL)
      ;['Função', 'Qtd', 'Regime', 'H/mês'].forEach((h, i) => {
        const xs = [ml + 8, ml + 220, ml + 280, ml + 340]
        text(page, sanitize(h), xs[i], y - 11, 7, boldFont, WHITE)
      })
      y -= 16

      profs.forEach((p, i) => {
        if (i % 2 === 0) rect(page, ml, y, W - ml - mr, 14, LIGHT)
        text(page, sanitize(p.role), ml + 8, y - 10, 8, font, DARK)
        text(page, String(p.quantity), ml + 220, y - 10, 8, font, DARK)
        text(page, sanitize(p.contractType), ml + 280, y - 10, 8, font, DARK)
        text(page, sanitize(p.hoursPerMonth ? `${p.hoursPerMonth}h` : '—'), ml + 340, y - 10, 8, font, DARK)
        y -= 14
      })
      y -= 12
    }

    // Escopo
    const escopoList = dim?.escopo ?? snapshot.escopoServicos ?? []
    if (escopoList.length) {
      text(page, sanitize('ESCOPO DE SERVIÇOS'), ml, y, 7, boldFont, GRAY)
      line(page, y - 4)
      y -= 18
      escopoList.forEach((s: string, i: number) => {
        text(page, sanitize(`>>  ${s}`), ml + (i % 2 === 0 ? 0 : 240), y - (i % 2 === 0 ? 0 : -14), 9, font, rgb(0.1, 0.48, 0.24))
        if (i % 2 === 1) y -= 18
      })
      if (escopoList.length % 2 !== 0) y -= 18
      y -= 8
    }

    // Investimento
    text(page, sanitize('INVESTIMENTO'), ml, y, 7, boldFont, GRAY)
    line(page, y - 4)
    y -= 18

    rect(page, ml, y, W - ml - mr, 40, DARK)
    text(page, sanitize('Investimento mensal'), ml + 12, y - 14, 8, font, rgb(0.8, 0.85, 0.9))
    text(page, sanitize(fmt(proposalValue)), W - mr - 130, y - 26, 14, boldFont, rgb(0.2, 0.69, 0.62))
    y -= 50

    // Validade
    const validDate = new Date(Date.now() + validityDays * 86400000)
    const validCols = [
      { l: 'Validade', v: `${validityDays} dias` },
      { l: 'Emissão', v: fmtDate(new Date().toISOString()) },
      { l: 'Válida até', v: fmtDate(validDate.toISOString()) },
    ]
    const vw = (W - ml - mr) / 3
    validCols.forEach((c, i) => {
      const x = ml + i * vw
      rect(page, x, y, vw - 4, 36, LIGHT)
      text(page, sanitize(c.l), x + 8, y - 10, 7, font, GRAY)
      text(page, sanitize(c.v), x + 8, y - 24, 9, boldFont, DARK)
    })
    y -= 46

    // Aprovações internas
    const aprovacoes = [
      params.submittedByName && { icon: '>>', label: 'Enviada para aprovacao técnica', by: params.submittedByName, at: null },
      params.technicalApprovedByName && {
        icon: 'OK', label: 'Aprovada tecnicamente', by: params.technicalApprovedByName,
        at: params.technicalApprovedAt, comment: params.technicalComment
      },
      params.commercialApprovedByName && {
        icon: 'OK', label: 'Aprovada comercialmente', by: params.commercialApprovedByName, at: params.commercialApprovedAt
      },
    ].filter(Boolean) as any[]

    if (aprovacoes.length) {
      text(page, sanitize('APROVAÇÕES INTERNAS'), ml, y, 7, boldFont, GRAY)
      line(page, y - 4)
      y -= 18

      aprovacoes.forEach(a => {
        text(page, sanitize(a.label), ml + 8, y, 9, boldFont, DARK)
        const meta = `por ${a.by}${a.at ? `  ·  ${fmtDate(a.at)}` : ''}`
        text(page, sanitize(meta), ml + 8, y - 12, 7, font, GRAY)
        if (a.comment) text(page, sanitize(`"${a.comment}"`), ml + 8, y - 22, 7, font, GRAY)
        y -= (a.comment ? 34 : 24)
      })
    }
  }

  return pdfDoc.save()
}
