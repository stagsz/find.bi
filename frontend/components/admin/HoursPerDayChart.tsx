'use client'

import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'

export interface HoursPerDayData {
  date: string
  label: string
  totalHours: number
  billableHours: number
}

interface HoursPerDayChartProps {
  data: HoursPerDayData[]
  theme: 'light' | 'dark'
}

export default function HoursPerDayChart({ data, theme }: HoursPerDayChartProps) {
  const isDark = theme === 'dark'
  const hasData = data.some(item => item.totalHours > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">No time entries in the last 7 days</p>
          <p className="text-sm mt-1">Time entries will appear here once logged</p>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f0f0f0'} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }}
          stroke={isDark ? '#4b5563' : '#6b7280'}
        />
        <YAxis
          tick={{ fontSize: 12, fill: isDark ? '#9ca3af' : '#6b7280' }}
          stroke={isDark ? '#4b5563' : '#6b7280'}
          label={{
            value: 'Hours',
            angle: -90,
            position: 'insideLeft',
            style: { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 }
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? '#1f2937' : 'white',
            border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
            borderRadius: '0.5rem',
            color: isDark ? '#f3f4f6' : '#111827'
          }}
          formatter={(value: number, name: string) => {
            const label = name === 'billableHours' ? 'Billable' : 'Total'
            return [`${value.toFixed(1)}h`, label]
          }}
          labelFormatter={(label: string) => label}
        />
        <Legend
          formatter={(value: string) => {
            if (value === 'totalHours') return 'Total Hours'
            if (value === 'billableHours') return 'Billable Hours'
            return value
          }}
          wrapperStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
        />
        <Bar
          dataKey="totalHours"
          fill={isDark ? '#6366f1' : '#4f46e5'}
          radius={[8, 8, 0, 0]}
          name="totalHours"
        />
        <Bar
          dataKey="billableHours"
          fill={isDark ? '#34d399' : '#10b981'}
          radius={[8, 8, 0, 0]}
          name="billableHours"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
