'use client'

import dynamic from 'next/dynamic'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { HoursPerDayData } from './HoursPerDayChart'

const HoursPerDayChart = dynamic(() => import('./HoursPerDayChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px]">
      <div className="text-gray-500 dark:text-gray-400">Loading chart...</div>
    </div>
  )
})

interface HoursPerDayChartWrapperProps {
  data: HoursPerDayData[]
}

export default function HoursPerDayChartWrapper({ data }: HoursPerDayChartWrapperProps) {
  const { theme } = useTheme()
  return <HoursPerDayChart data={data} theme={theme} />
}
