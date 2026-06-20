// YYYY-MM-DD → DD/MM/YYYY
export function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthName(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, 1)
  const month = date.toLocaleString('ca-ES', { month: 'long' })
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${y}`
}

export function toYearMonth(dateStr) {
  return dateStr?.slice(0, 7) || ''
}

// Parse import accepting both "12,50" and "12.50"
export function parseImport(val) {
  return parseFloat(String(val).replace(',', '.')) || 0
}

// "2026-06" or "2026-06-20" → "20 juny 2026" (or "juny 2026" if no day)
export function fmtDateLong(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parts[2] ? parseInt(parts[2]) : null
  const date = new Date(y, m - 1, d || 1)
  const month = date.toLocaleString('ca-ES', { month: 'long' })
  return d ? `${d} ${month} ${y}` : `${month} ${y}`
}
