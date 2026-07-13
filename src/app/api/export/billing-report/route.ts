import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

// NOTA DE INCERTEZA: a API do pacote "xlsx" (SheetJS) abaixo é a que eu
// conheço, mas não tive como testar a geração do arquivo ao vivo neste
// ambiente — se o Excel baixado vier com problema (não abrir, formato
// errado), me avise com o que exatamente aconteceu.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month) {
    return NextResponse.json({ error: 'Informe year e month.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: records } = await supabase
    .from('billing_records')
    .select('contract_id, amount, notes')
    .eq('year', year)
    .eq('month', month)

  const contractIds = [...new Set((records ?? []).map((r) => r.contract_id))]

  const { data: contracts } = contractIds.length
    ? await supabase.from('contracts').select('id, client_name, company_id, process_number').in('id', contractIds)
    : { data: [] as { id: string; client_name: string; company_id: string | null; process_number: string }[] }

  const companyIds = [...new Set((contracts ?? []).map((c) => c.company_id).filter((v): v is string => !!v))]
  const { data: companies } = companyIds.length
    ? await supabase.from('companies').select('id, name, cnpj').in('id', companyIds)
    : { data: [] as { id: string; name: string; cnpj: string | null }[] }

  const contractById = new Map((contracts ?? []).map((c) => [c.id, c]))
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]))

  const rows = (records ?? []).map((r) => {
    const contract = contractById.get(r.contract_id)
    const company = contract?.company_id ? companyById.get(contract.company_id) : null
    return {
      'Cliente': company?.name ?? contract?.client_name ?? '—',
      'CNPJ': company?.cnpj ?? '—',
      'Nº do Processo': contract?.process_number ?? '—',
      'Valor a Faturar (R$)': Number(r.amount),
      'Observações': r.notes ?? '',
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 30 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Faturamento')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  const monthStr = String(month).padStart(2, '0')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="faturamento-${year}-${monthStr}.xlsx"`,
    },
  })
}
