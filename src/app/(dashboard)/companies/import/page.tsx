import { CsvImportForm } from '@/components/companies/csv-import-form'

export default function ImportCompaniesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Importar Empresas (CSV)</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Cadastre em massa as empresas que já fazem parte da sua base de clientes.
        </p>
      </div>
      <CsvImportForm />
    </div>
  )
}
