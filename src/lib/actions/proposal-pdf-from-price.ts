import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ── Helpers ────────────────────────────────────────────────────────────────
function s(text: string | null | undefined): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '\u00e1':'a','\u00e0':'a','\u00e3':'a','\u00e2':'a',
    '\u00c1':'A','\u00c0':'A','\u00c3':'A','\u00c2':'A',
    '\u00e9':'e','\u00e8':'e','\u00ea':'e',
    '\u00c9':'E','\u00ca':'E',
    '\u00ed':'i','\u00ee':'i','\u00cd':'I',
    '\u00f3':'o','\u00f5':'o','\u00f4':'o',
    '\u00d3':'O','\u00d4':'O','\u00d5':'O',
    '\u00fa':'u','\u00fb':'u','\u00da':'U',
    '\u00e7':'c','\u00c7':'C',
    '\u2019':"'",'`':"'"
  }
  return Array.from(text).map(c => map[c] ?? (c.charCodeAt(0) > 127 ? '' : c)).join('')
}

function money(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dateStr(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function wrap(text: string, font: any, size: number, maxW: number): string[] {
  const words = s(text).split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (font.widthOfTextAtSize(test, size) <= maxW) {
      cur = test
    } else {
      if (cur) lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function wrapBlock(text: string, font: any, size: number, maxW: number): string[] {
  if (!text?.trim()) return []
  const out: string[] = []
  for (const para of s(text).split('\n')) {
    if (!para.trim()) { out.push(''); continue }
    out.push(...wrap(para, font, size, maxW))
  }
  return out
}

// ── Builder principal ──────────────────────────────────────────────────────
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
  company?: { name?: string; cnpj?: string; address?: string } | null
  contact?: { name?: string; email?: string } | null
  org?: { companyName?: string; cnpj?: string; address?: string; proposalCode?: string } | null
  textoObjetivos?: string | null
  textoAtividades?: string | null
  textoEstruturaApoio?: string | null
}): Promise<Uint8Array> {
  const { snapshot: snap, proposalValue, validityDays } = params
  const org = params.org ?? {}

  const doc  = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await doc.embedFont(StandardFonts.Helvetica)

  // A4 em pontos
  const PW = 595.28, PH = 841.89
  const ML = 56, MR = 56, MT = 56, MB = 48
  const CW = PW - ML - MR  // 483.28

  // Cores
  const DARK = rgb(0.07, 0.10, 0.18)
  const TEAL = rgb(0.08, 0.33, 0.41)
  const GRAY = rgb(0.40, 0.42, 0.50)
  const LGRAY= rgb(0.88, 0.90, 0.92)
  const WHITE= rgb(1,1,1)
  const LTEAL= rgb(0.93, 0.97, 0.97)

  let page = doc.addPage([PW, PH])
  let y = PH - MT

  function footer() {
    const today = new Date().toLocaleDateString('pt-BR')
    const valid = new Date(Date.now() + validityDays*86400000).toLocaleDateString('pt-BR')
    page.drawText(`${today} - Validade: ${valid}`, { x: ML, y: MB - 14, size: 7, font: reg, color: GRAY })
    const code = s(org.proposalCode ?? '')
    page.drawText(code, { x: PW-MR - bold.widthOfTextAtSize(code,7), y: MB-14, size: 7, font: bold, color: GRAY })
    page.drawLine({ start:{x:ML,y:MB-4}, end:{x:PW-MR,y:MB-4}, thickness:0.3, color:LGRAY })
  }

  function newPage() {
    footer()
    page = doc.addPage([PW, PH])
    y = PH - MT
  }

  function ensureSpace(needed: number) {
    if (y - needed < MB + 16) newPage()
  }

  // Desenha texto simples, retorna nova posição Y
  function dt(text: string, x: number, yy: number, sz: number, f = reg, c = DARK): number {
    page.drawText(s(text), { x, y: yy, size: sz, font: f, color: c })
    return yy - sz - 3
  }

  // Linha horizontal
  function hline(yy: number, color = LGRAY, thickness = 0.4) {
    page.drawLine({ start:{x:ML,y:yy}, end:{x:PW-MR,y:yy}, thickness, color })
  }

  // Seção título estilo Samaritano (negrito underline)
  function secTitle(title: string): number {
    ensureSpace(24)
    dt(s(title), ML, y, 9, bold, DARK)
    page.drawRectangle({ x: ML, y: y-13, width: bold.widthOfTextAtSize(s(title),9), height: 1.5, color: TEAL })
    y -= 22
    return y
  }

  // Parágrafo com wrap
  function paragraph(text: string | null | undefined, sz = 8.5, indent = 0): void {
    if (!text?.trim()) return
    const lines = wrapBlock(text, reg, sz, CW - indent)
    for (const line of lines) {
      ensureSpace(sz + 4)
      if (line) page.drawText(line, { x: ML + indent, y, size: sz, font: reg, color: DARK })
      y -= sz + (line ? 3 : 4)
    }
  }

  // Bullet list
  function bullets(text: string | null | undefined, sz = 8.5): void {
    if (!text?.trim()) return
    for (const line of s(text).split('\n')) {
      const clean = line.replace(/^[-•*\d.]+\s*/, '').trim()
      if (!clean) continue
      const wrapped = wrap(clean, reg, sz, CW - 16)
      wrapped.forEach((l, i) => {
        ensureSpace(sz + 4)
        if (i === 0) {
          page.drawText('-', { x: ML + 4, y, size: sz, font: bold, color: TEAL })
        }
        page.drawText(l, { x: ML + 16, y, size: sz, font: reg, color: DARK })
        y -= sz + 3
      })
    }
  }

  // ── PÁGINA 1: Cabeçalho ─────────────────────────────────────────────────
  // Box topo — Orbis + contato
  page.drawRectangle({ x: ML, y: y-72, width: CW, height: 72, color: LTEAL })
  page.drawRectangle({ x: ML, y: y-72, width: 2, height: 72, color: TEAL })

  // Nome Orbis
  const orgName = s(org.companyName ?? 'ORBIS GESTAO DE TECNOLOGIA EM SAUDE LTDA')
  page.drawText(orgName, { x: ML+10, y: y-14, size: 9, font: bold, color: TEAL })
  if (org.cnpj) page.drawText(`CNPJ: ${s(org.cnpj)}`, { x: ML+10, y: y-26, size: 8, font: reg, color: DARK })
  if (org.address) {
    const al = wrap(s(org.address), reg, 7.5, 200)
    al.forEach((l,i) => page.drawText(l, { x: ML+10, y: y-38-i*10, size: 7.5, font: reg, color: DARK }))
  }

  // Contato lado direito
  const cName = s(params.contact?.name ?? '')
  const cEmail = s(params.contact?.email ?? '')
  if (cName) {
    page.drawText('Contato', { x: PW-MR-160, y: y-14, size: 8, font: bold, color: DARK })
    page.drawText(cName,  { x: PW-MR-160, y: y-26, size: 8, font: reg, color: DARK })
    if (cEmail) page.drawText(cEmail, { x: PW-MR-160, y: y-38, size: 7.5, font: reg, color: GRAY })
  }
  y -= 82

  // Box duplo — pessoa + empresa
  const boxH = 64
  ;[[ML, CW/2-3], [ML+CW/2+3, CW/2-3]].forEach(([bx, bw], idx) => {
    page.drawRectangle({ x: bx, y: y-boxH, width: bw, height: boxH, color: WHITE })
    page.drawLine({ start:{x:bx,y}, end:{x:bx+bw,y}, thickness:0.5, color:LGRAY })
    page.drawLine({ start:{x:bx,y:y-boxH}, end:{x:bx+bw,y:y-boxH}, thickness:0.5, color:LGRAY })
    page.drawLine({ start:{x:bx,y}, end:{x:bx,y:y-boxH}, thickness:0.5, color:LGRAY })
    page.drawLine({ start:{x:bx+bw,y}, end:{x:bx+bw,y:y-boxH}, thickness:0.5, color:LGRAY })

    if (idx === 0) {
      page.drawText('Dados da pessoa', { x: bx+8, y: y-12, size: 7, font: reg, color: GRAY })
      page.drawText(cName, { x: bx+8, y: y-24, size: 9, font: bold, color: DARK })
      if (cEmail) page.drawText(`E-mails: ${cEmail}`, { x: bx+8, y: y-38, size: 7.5, font: reg, color: DARK })
    } else {
      const compName = s(params.company?.name ?? params.contract?.client_name ?? '')
      page.drawText('Dados da empresa', { x: bx+8, y: y-12, size: 7, font: reg, color: GRAY })
      page.drawText(compName, { x: bx+8, y: y-24, size: 9, font: bold, color: DARK })
      if (params.company?.cnpj || params.contract?.cnpj) {
        page.drawText(`CNPJ: ${s(params.company?.cnpj ?? params.contract?.cnpj ?? '')}`, { x: bx+8, y: y-38, size: 7.5, font: reg, color: DARK })
      }
      if (params.company?.address) {
        const al = wrap(s(params.company.address), reg, 7, bw-16)
        al.slice(0,2).forEach((l,i) => page.drawText(l, { x: bx+8, y: y-50-i*9, size: 7, font: reg, color: DARK }))
      }
    }
  })
  y -= boxH + 20

  // OBJETIVOS
  secTitle('OBJETIVOS')
  paragraph(params.textoObjetivos)
  y -= 10

  // ATIVIDADES
  ensureSpace(40)
  secTitle('ATIVIDADES A SEREM DESENVOLVIDAS')
  bullets(params.textoAtividades)
  y -= 8

  // ── Pg 2: Equipe + Estrutura + Escopo ──────────────────────────────────
  newPage()

  // EQUIPE ALOCADA
  secTitle('EQUIPE ALOCADA')
  const profs = (snap.professionals ?? []).filter((p: any) => p.role?.trim())

  if (profs.length > 0) {
    // Header tabela
    const cols = [
      { label: 'QUANT.', x: ML, w: 38 },
      { label: 'PROFISSIONAL', x: ML+40, w: 160 },
      { label: 'ESCALA DE TRABALHO', x: ML+202, w: 140 },
      { label: 'OBSERVACAO', x: ML+344, w: CW-344 },
    ]
    page.drawRectangle({ x: ML, y: y-14, width: CW, height: 14, color: TEAL })
    cols.forEach(c => page.drawText(c.label, { x: c.x+3, y: y-10, size: 6, font: bold, color: WHITE }))
    y -= 14

    profs.forEach((p: any, i: number) => {
      ensureSpace(18)
      if (i % 2 === 0) page.drawRectangle({ x: ML, y: y-14, width: CW, height: 14, color: LTEAL })
      const carga = p.hoursPerMonth === 220 ? '44h semanais' : p.hoursPerMonth === 180 ? '12x36 h' : `${p.hoursPerMonth}h/mes`
      page.drawText(`0${p.quantity}`, { x: ML+3, y: y-10, size: 8, font: reg, color: DARK })
      page.drawText(s(p.role), { x: ML+40, y: y-10, size: 8, font: reg, color: DARK })
      page.drawText(carga, { x: ML+202, y: y-10, size: 8, font: reg, color: DARK })
      y -= 14
    })
    y -= 12
  }

  // ESTRUTURA DE APOIO
  if (params.textoEstruturaApoio?.trim()) {
    secTitle('ESTRUTURA DE APOIO')
    bullets(params.textoEstruturaApoio)
    y -= 10
  }

  // ESCOPO DE SERVICO
  const escopo: string[] = snap.escopoSanitizado ?? snap.escopoServicos ?? []
  if (escopo.length > 0) {
    ensureSpace(40)
    secTitle('ESCOPO DE SERVICO')
    for (const item of escopo) {
      ensureSpace(14)
      page.drawText('-', { x: ML+4, y, size: 8.5, font: bold, color: TEAL })
      page.drawText(s(item), { x: ML+16, y, size: 8.5, font: reg, color: DARK })
      y -= 13
    }
    y -= 8
  }

  // ── Pg 3: Itens MRR + Financeiro ───────────────────────────────────────
  newPage()

  const dur = snap.contractDuration ?? 12
  const total = proposalValue * dur
  const catNome = s(snap.tipoEngenharia === 'Hospitalar' ? 'Eng. Hospitalar' : 'Engenharia Clinica')
  const itemNome = s(snap.tituloItemServico ?? 'Servico Continuo de Engenharia')

  // Título seção
  page.drawRectangle({ x: ML, y: y-16, width: CW, height: 16, color: DARK })
  page.drawText('Mensalidade (MRR):', { x: ML+8, y: y-11, size: 8.5, font: bold, color: WHITE })
  y -= 16

  // Header tabela itens
  const iCols = [
    { l:'Qtd.', x:ML },
    { l:'Cat.', x:ML+30 },
    { l:'Duracao', x:ML+102 },
    { l:'Cobranca', x:ML+150 },
    { l:'Item', x:ML+205 },
    { l:'Valor unit.', x:ML+300 },
    { l:'Tipo', x:ML+375 },
    { l:'Subtotal', x:ML+415 },
  ]
  page.drawRectangle({ x: ML, y: y-13, width: CW, height: 13, color: LGRAY })
  iCols.forEach(c => page.drawText(c.l, { x: c.x+2, y: y-9.5, size: 6, font: bold, color: GRAY }))
  y -= 13

  // Linha do item
  page.drawRectangle({ x: ML, y: y-36, width: CW, height: 36, color: rgb(0.99,0.99,1) })
  hline(y); hline(y-36)
  page.drawText('1 UN', { x: ML+2, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText(catNome, { x: ML+30, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText(`${dur} meses`, { x: ML+102, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText('Mensal', { x: ML+150, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText(itemNome, { x: ML+205, y: y-10, size: 8, font: bold, color: DARK })
  page.drawText(money(proposalValue), { x: ML+300, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText('MRR', { x: ML+375, y: y-10, size: 8, font: reg, color: DARK })
  page.drawText(money(proposalValue), { x: ML+415, y: y-10, size: 8, font: bold, color: DARK })

  // Características
  const chars = (snap.escopoSanitizado ?? snap.escopoServicos ?? []).join(' - ')
  const charLines = wrap(`Caracteristicas: ${s(chars)}`, reg, 7, CW-4)
  charLines.slice(0,2).forEach((l,i) => {
    page.drawText(l, { x: ML+2, y: y-22-i*9, size: 7, font: reg, color: GRAY })
  })
  y -= 46

  // Resumo
  y -= 8
  page.drawText('Resumo da proposta', { x: ML, y, size: 10, font: bold, color: DARK })
  y -= 16
  ;[
    { k: 'Contrato', v: `${catNome} ${dur} meses` },
    { k: 'Tipo de cobranca', v: 'Mensal' },
  ].forEach(r => {
    page.drawText(r.k, { x: ML, y, size: 8.5, font: reg, color: GRAY })
    page.drawText(r.v, { x: ML+140, y, size: 8.5, font: reg, color: DARK })
    y -= 14
  })
  y -= 4
  hline(y)
  y -= 10

  // Parcelas
  for (let i = 1; i <= Math.min(dur, 12); i++) {
    ensureSpace(13)
    if (i % 2 === 0) page.drawRectangle({ x: ML, y: y-11, width: CW, height: 11, color: LTEAL })
    page.drawText(`${i}a parc.:`, { x: ML, y, size: 8, font: reg, color: DARK })
    page.drawText(money(proposalValue), { x: ML+80, y, size: 8, font: bold, color: DARK })
    page.drawText('A combinar', { x: ML+200, y, size: 8, font: reg, color: GRAY })
    page.drawText('Boleto', { x: ML+290, y, size: 8, font: reg, color: GRAY })
    y -= 12
  }
  y -= 8

  hline(y)
  y -= 14
  page.drawText('Valor total do contrato:', { x: ML, y, size: 10, font: bold, color: DARK })
  page.drawText(money(total), { x: PW-MR-bold.widthOfTextAtSize(money(total),12), y, size: 12, font: bold, color: TEAL })
  y -= 24

  // Aprovações
  const aprovs = [
    params.submittedByName && { l:'Enviada para aprovacao tecnica', by:params.submittedByName, at:null },
    params.technicalApprovedByName && { l:'Aprovada tecnicamente', by:params.technicalApprovedByName, at:params.technicalApprovedAt, comment:params.technicalComment },
    params.commercialApprovedByName && { l:'Aprovada comercialmente', by:params.commercialApprovedByName, at:params.commercialApprovedAt },
  ].filter(Boolean) as any[]

  if (aprovs.length) {
    ensureSpace(20)
    hline(y+4)
    y -= 6
    page.drawText('Aprovacoes internas:', { x: ML, y, size: 8, font: bold, color: GRAY })
    y -= 13
    aprovs.forEach((a: any) => {
      ensureSpace(16)
      page.drawText(`- ${s(a.l)} por ${s(a.by)}${a.at ? ` em ${dateStr(a.at)}` : ''}`, { x: ML+8, y, size: 8, font: reg, color: GRAY })
      y -= 12
      if (a.comment) {
        const cl = wrap(`"${s(a.comment)}"`, reg, 7.5, CW-20)
        cl.forEach(l => { ensureSpace(12); page.drawText(l, { x: ML+14, y, size: 7.5, font: reg, color: GRAY }); y -= 11 })
      }
    })
  }

  footer()
  return doc.save()
}
