'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { BillableBreakdownData } from './BillableBreakdownChart'

const BillableBreakdownChart = dynamic(() => import('./BillableBreakdownChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[250px]">
      <div className="text-gray-500 dark:text-gray-400">Loading chart...</div>
    </div>
  )
})

interface BillableBreakdownChartWrapperProps {
  data: BillableBreakdownData
}

export default function BillableBreakdownChartWrapper({ data }: BillableBreakdownChartWrapperProps) {
  const { theme } = useTheme()
  return <BillableBreakdownChart data={data} theme={theme} />
}
