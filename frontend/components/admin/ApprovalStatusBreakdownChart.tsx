'use client'

import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts'

export interface ApprovalStatusBreakdownData {
  approvedMinutes: number
  submittedMinutes: number
  draftMinutes: number
  rejectedMinutes: number
}

interface ApprovalStatusBreakdownChartProps {
  data: ApprovalStatusBreakdownData
  theme: 'light' | 'dark'
}

export default function ApprovalStatusBreakdownChart({ data, theme }: ApprovalStatusBreakdownChartProps) {
  const isDark = theme === 'dark'
  const total = data.approvedMinutes + data.submittedMinutes + data.draftMinutes + data.rejectedMinutes

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No time entries</p>
          <p className="text-sm mt-1">Approval status breakdown will appear here once time is logged</p>
        </div>
      </div>
    )
  }

  const chartData = [
    { name: 'Approved', value: Math.round((data.approvedMinutes / 60) * 10) / 10 },
    { name: 'Submitted', value: Math.round((data.submittedMinutes / 60) * 10) / 10 },
    { name: 'Draft', value: Math.round((data.draftMinutes / 60) * 10) / 10 },
    { name: 'Rejected', value: Math.round((data.rejectedMinutes / 60) * 10) / 10 },
  ].filter(d => d.value > 0)

  const COLOR_MAP: Record<string, string> = isDark
    ? { Approved: '#34d399', Submitted: '#fbbf24', Draft: '#6b7280', Rejected: '#f87171' }
    : { Approved: '#10b981', Submitted: '#f59e0b', Draft: '#9ca3af', Rejected: '#ef4444' }

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
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name]} />
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
