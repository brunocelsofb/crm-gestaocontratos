'use client'

export function ExportReportButton({ from, to, tab }: { from: string; to: string; tab: string }) {
  function handlePrint() {
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 print:hidden"
    >
      📄 Exportar PDF
    </button>
  )
}
