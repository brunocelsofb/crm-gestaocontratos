'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const COLORS = ['#1B556B', '#2D7A94', '#4B9BB5', '#7FBED2', '#A8D5E5', '#C9E6F0']

export function TicketBreakdownChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div style={{ width: '100%', height: Math.max(180, data.length * 36) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
