'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { rupiah } from '@/lib/format'

export type TrenRow = { bulan: string; online: number; offline: number; perkiraan: number }

const fmtAxis = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)} jt` : String(v))

export default function TrenChart({ data }: { data: TrenRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#C9CFC6" vertical={false} />
        <XAxis dataKey="bulan" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={52} />
        <Tooltip
          cursor={{ fill: '#EEF0EC' }}
          formatter={(v: unknown) => rupiah(Number(v))}
          contentStyle={{ backgroundColor: '#F8F9F6', borderRadius: 0, borderColor: '#C9CFC6' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="online" name="Online" stackId="a" fill="#23322B" isAnimationActive={false} />
        <Bar dataKey="offline" name="Offline" stackId="a" fill="#55645C" isAnimationActive={false} />
        <Bar dataKey="perkiraan" name="Perkiraan" fill="#E8A31733" stroke="#E8A317" strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
