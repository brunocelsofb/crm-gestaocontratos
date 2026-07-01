'use client'

// NOTA: API do recharts é relativamente estável, mas não tenho certeza
// absoluta de que os nomes de props abaixo não mudaram na versão mais
// recente — confira a documentação (recharts.org) se algo não renderizar.

import { Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export function StageValueChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={50}
          />
          <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v) =>
              new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
