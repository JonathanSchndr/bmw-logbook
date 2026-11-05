function tzFormatParts(date: Date, tz: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]))
}

export function tzLocalMidnightUTC(year: number, month: number, day: number, tz: string): Date {
  const approx = Date.UTC(year, month, day)
  const parts = tzFormatParts(new Date(approx), tz)
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
  const offset = asUTC - approx
  return new Date(approx - offset)
}

export function tzCurrentYearMonth(tz: string): { year: number; month: number } {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric' })
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).map(p => [p.type, p.value]))
  return { year: +parts.year, month: +parts.month - 1 }
}
