'use client'

import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts'

export interface BillableBreakdownData {
  billableMinutes: number
  nonBillableMinutes: number
}

interface BillableBreakdownChartProps {
  data: BillableBreakdownData
  theme: 'light' | 'dark'
}

export default function BillableBreakdownChart({ data, theme }: BillableBreakdownChartProps) {
  const isDark = theme === 'dark'
  const total = data.billableMinutes + data.nonBillableMinutes

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No time entries</p>
          <p className="text-sm mt-1">Billable breakdown will appear here once time is logged</p>
        </div>
      </div>
    )
  }

  const chartData = [
    { name: 'Billable', value: Math.round((data.billableMinutes / 60) * 10) / 10 },
    { name: 'Non-Billable', value: Math.round((data.nonBillableMinutes / 60) * 10) / 10 },
  ]

  const COLORS = isDark
    ? ['#34d399', '#6b7280']
    : ['#10b981', '#9ca3af']

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1f2937' : 'white',
            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            borderRadius: '0.5rem',
            color: isDark ? '#f3f4f6' : '#111827'
          }}
          formatter={(value: number) => [`${value.toFixed(1)}h`, '']}
        />
        <Legend
          wrapperStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
