'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { ApprovalStatusBreakdownData } from './ApprovalStatusBreakdownChart'

const ApprovalStatusBreakdownChart = dynamic(() => import('./ApprovalStatusBreakdownChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[250px]">
      <div className="text-gray-500 dark:text-gray-400">Loading chart...</div>
    </div>
  )
})

interface ApprovalStatusBreakdownChartWrapperProps {
  data: ApprovalStatusBreakdownData
}

export default function ApprovalStatusBreakdownChartWrapper({ data }: ApprovalStatusBreakdownChartWrapperProps) {
  const { theme } = useTheme()
  return <ApprovalStatusBreakdownChart data={data} theme={theme} />
}
