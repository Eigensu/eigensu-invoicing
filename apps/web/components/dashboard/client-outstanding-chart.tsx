'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatINR } from '@eigensu/core'

export interface ClientOutstandingPoint {
  client: string
  outstanding: number
}

interface Props {
  data: ClientOutstandingPoint[]
}

export function ClientOutstandingChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200">
        <p className="text-sm text-slate-500">No outstanding balances. Great work!</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatINR(v)}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
        />
        <YAxis
          dataKey="client"
          type="category"
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={120}
        />
        <Tooltip
          formatter={(value: number) => [formatINR(value), 'Outstanding']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
