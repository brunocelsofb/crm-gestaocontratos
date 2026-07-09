'use client'

// NOTA DE INCERTEZA: uso a biblioteca `papaparse` para ler o CSV no
// navegador. A API que uso (Papa.parse com header:true) é a que eu
// conheço, mas não testei ao vivo com um arquivo real — se o parse vier
// estranho (colunas trocadas, acentos quebrados), me avise com um
// exemplo do arquivo.

import { useState } from 'react'
import Papa from 'papaparse'
import { useRouter } from 'next/navigation'
import { bulkImportCompanies, type ImportRow, type ImportResult } from '@/lib/actions/companies-import'

// Tenta reconhecer variações comuns de nome de coluna (com/sem acento,
// maiúsculas, em inglês ou português), para não obrigar um formato rígido.
function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

function extractRows(data: Record<string, string>[]): ImportRow[] {
  return data.map((row) => {
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = (value ?? '').trim()
    }

    const name =
      normalized['nome'] || normalized['razao social'] || normalized['razao_social'] || normalized['name'] || ''
    const cnpj = normalized['cnpj']?.replace(/\D/g, '') || null
    const tradeName =
      normalized['nome fantasia'] || normalized['nome_fantasia'] || normalized['fantasia'] || normalized['trade_name'] || null

    return { name, cnpj, trade_name: tradeName }
  })
}

export function CsvImportForm() {
  const router = useRouter()
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParsing(true)
    setError(null)
    setResult(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false)
        const parsed = extractRows(results.data)
        if (parsed.every((r) => !r.name)) {
          setError(
            'Não consegui identificar a coluna de nome/razão social. O arquivo precisa ter uma coluna chamada "nome", "razão social" ou "name".'
          )
          setRows(null)
          return
        }
        setRows(parsed)
      },
      error: (err: Error) => {
        setParsing(false)
        setError(`Falha ao ler o arquivo: ${err.message}`)
      },
    })
  }

  async function handleImport() {
    if (!rows) return
    setImporting(true)
    setError(null)

    const validRows = rows.filter((r) => r.name)
    const res = await bulkImportCompanies(validRows)
    setImporting(false)
    setResult(res)

    if (res.errors.length === 0) {
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="mx-auto block text-sm"
        />
        <p className="mt-2 text-xs text-gray-400">
          Arquivo .csv com colunas: <strong>nome</strong> (obrigatório), <strong>cnpj</strong> e{' '}
          <strong>nome fantasia</strong> (opcionais).
        </p>
      </div>

      {parsing && <p className="text-sm text-gray-500">Lendo arquivo...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows && rows.length > 0 && !result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <strong>{fileName}</strong> — {rows.filter((r) => r.name).length} linha(s) válida(s) encontrada(s) de {rows.length} no total.
          </p>

          <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Nome</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">CNPJ</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Nome Fantasia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className={r.name ? '' : 'bg-red-50'}>
                    <td className="px-3 py-1.5">{r.name || <span className="text-red-500">sem nome — será ignorada</span>}</td>
                    <td className="px-3 py-1.5 font-mono">{r.cnpj || '—'}</td>
                    <td className="px-3 py-1.5">{r.trade_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && <p className="text-xs text-gray-400">Mostrando as primeiras 50 linhas de {rows.length}.</p>}

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {importing ? 'Importando...' : `Importar ${rows.filter((r) => r.name).length} empresa(s)`}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p className="font-medium text-gray-900">Importação concluída</p>
          <p className="mt-1 text-gray-600">
            {result.imported} empresa(s) importada(s)
            {result.skipped > 0 && ` · ${result.skipped} pulada(s) (CNPJ já cadastrado)`}
          </p>
          {result.errors.map((e, i) => (
            <p key={i} className="mt-1 text-red-600">{e}</p>
          ))}
        </div>
      )}
    </div>
  )
}
