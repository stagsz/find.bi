export type DateRangePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'all' | 'custom'

export function getPresetDates(preset: DateRangePreset): { start: string; end: string } | null {
  const today = new Date()
  const end = today.toISOString().split('T')[0]

  switch (preset) {
    case '7d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 7)
      return { start: start.toISOString().split('T')[0], end }
    }
    case '30d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 30)
      return { start: start.toISOString().split('T')[0], end }
    }
    case '90d': {
      const start = new Date(today)
      start.setDate(start.getDate() - 90)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'mtd': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1)
      return { start: start.toISOString().split('T')[0], end }
    }
    case 'all':
    default:
      return null
  }
}

export function getDateRangeFromParams(params: {
  start?: string
  end?: string
  range?: string
}): { startDate: string | null; endDate: string | null } {
  const preset = (params.range || 'all') as DateRangePreset

  if (preset === 'custom' && params.start && params.end) {
    return { startDate: params.start, endDate: params.end }
  }

  const presetDates = getPresetDates(preset)
  if (presetDates) {
    return { startDate: presetDates.start, endDate: presetDates.end }
  }

  return { startDate: null, endDate: null }
}
