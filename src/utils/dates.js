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
