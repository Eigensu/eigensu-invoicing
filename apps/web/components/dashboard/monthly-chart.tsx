'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatINR } from '@eigensu/core'

export interface MonthlyDataPoint {
  month: string
  billed: number
  received: number
}

interface Props {
  data: MonthlyDataPoint[]
}

function fmtAxis(value: number): string {
  if (value >= 1000000) return `₹${(value / 100000).toFixed(0)}L`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value}`
}

export function MonthlyChart({ data }: Props) {
  const hasData = data.some((d) => d.billed > 0 || d.received > 0)

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200">
        <p className="text-sm text-slate-500">No billing data yet.</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#94a3b8' }} width={64} />
        <Tooltip
          formatter={(value: number) => formatINR(value)}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="billed" name="Billed" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="received" name="Received" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
