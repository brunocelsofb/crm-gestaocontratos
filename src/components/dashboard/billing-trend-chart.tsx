'use client'

// NOTA: mesma ressalva de sempre sobre a API do recharts — confira a
// documentação se algo não renderizar como esperado.

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

export function BillingTrendChart({ data }: { data: { label: string; meta: number; faturado: number }[] }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
          <Tooltip
            formatter={(v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="meta" name="Meta" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="faturado" name="Faturado" fill="#1B556B" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
