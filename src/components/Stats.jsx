import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
import { monthName } from '../utils/dates'

const COLORS_DARK       = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc', '#fb923c', '#a3e635']
const COLORS_LIGHT      = ['#6366f1', '#059669', '#d97706', '#dc2626', '#0891b2', '#9333ea', '#ea580c', '#65a30d']
const COLORS_DARK_PINK  = ['#f472b6', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#e879a8', '#fb923c', '#a78bfa']
const COLORS_LIGHT_PINK = ['#c8256a', '#059669', '#d97706', '#e11d48', '#0891b2', '#be185d', '#ea580c', '#7c3aed']

function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark' }
function isLight() { const t = getTheme(); return t === 'light' || t === 'light-pink' }
function getColors() {
  const t = getTheme()
  if (t === 'light-pink') return COLORS_LIGHT_PINK
  if (t === 'dark-pink')  return COLORS_DARK_PINK
  if (t === 'light')      return COLORS_LIGHT
  return COLORS_DARK
}
function barColor(name) {
  const t = getTheme()
  const dark = t === 'dark' || t === 'dark-pink'
  const pink = t === 'dark-pink' || t === 'light-pink'
  if (name === 'ingressos') return dark ? '#22c55e' : '#16a34a'
  if (name === 'gastos')    return dark ? '#ef4444' : '#dc2626'
  return pink ? (dark ? '#e879a8' : '#c8256a') : (dark ? '#818cf8' : '#6366f1')
}

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function groupBy(txs, key) {
  return txs.reduce((acc, tx) => {
    acc[tx[key]] = (acc[tx[key]] || 0) + tx.importe
    return acc
  }, {})
}

function ym2label(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${m}/${y?.slice(2)}`
}

function buildMonthData(transactions, months) {
  const map = {}
  months.forEach(ym => { map[ym] = { mes: ym2label(ym), gastos: 0, ingressos: 0, balanc: 0 } })
  transactions.forEach(tx => {
    const ym = tx.fecha?.slice(0, 7) || ''
    if (map[ym]) {
      map[ym][tx.tipo === 'gasto' ? 'gastos' : 'ingressos'] += tx.importe
    }
  })
  months.forEach(ym => { map[ym].balanc = map[ym].ingressos - map[ym].gastos })
  return months.map(ym => map[ym])
}

function buildIngressosByMonth(transactions, months, selectedCats) {
  const map = {}
  months.forEach(ym => {
    const entry = { mes: ym2label(ym) }
    selectedCats.forEach(c => { entry[c] = 0 })
    entry._total = 0
    map[ym] = entry
  })
  transactions.filter(t => t.tipo === 'ingreso').forEach(tx => {
    const ym = tx.fecha?.slice(0, 7) || ''
    if (!map[ym]) return
    if (selectedCats.length === 0 || selectedCats.includes(tx.categoria)) {
      map[ym][tx.categoria] = (map[ym][tx.categoria] || 0) + tx.importe
      map[ym]._total += tx.importe
    }
  })
  return months.map(ym => map[ym])
}

function PeriodSelector({ period, setPeriod, selYear, setSelYear, selMonth, setSelMonth, years, allYMs }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {[['ytd', 'YTD'], ['any', 'Any'], ['mes', 'Mes']].map(([v, l]) => (
        <button key={v} className={`filter-chip ${period === v ? 'active' : ''}`} onClick={() => setPeriod(v)}>{l}</button>
      ))}
      {period === 'any' && (
        <select value={selYear} onChange={e => setSelYear(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 20, padding: '5px 12px', fontSize: 12 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
      {period === 'mes' && (
        <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 20, padding: '5px 12px', fontSize: 12 }}>
          {[...allYMs].reverse().map(ym => <option key={ym} value={ym}>{monthName(ym)}</option>)}
        </select>
      )}
    </div>
  )
}

function DespesesTab({ filteredTxs, chartMonths, period }) {
  const gastos = filteredTxs.filter(t => t.tipo === 'gasto')
  const ingresos = filteredTxs.filter(t => t.tipo === 'ingreso')

  const byCat = groupBy(gastos, 'categoria')
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  const maxCat = Math.max(...catData.map(d => d.value), 1)

  const monthData = period !== 'mes' ? buildMonthData(filteredTxs, chartMonths) : []

  const totalIngresos = ingresos.reduce((s, t) => s + t.importe, 0)
  const totalGastos = gastos.reduce((s, t) => s + t.importe, 0)

  return (
    <div>
      {monthData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Evolució mensual</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip
                  contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }}
                  formatter={(v, name) => [fmt(v), name === 'gastos' ? 'Despeses' : name === 'ingressos' ? 'Ingressos' : 'Balanç']}
                />
                <Bar dataKey="ingressos" fill={barColor('ingressos')} radius={[4, 4, 0, 0]} animationDuration={400} />
                <Bar dataKey="gastos" fill={barColor('gastos')} radius={[4, 4, 0, 0]} animationDuration={400} />
                <Bar dataKey="balanc" fill={barColor('balanc')} radius={[4, 4, 0, 0]} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
            <span><span style={{ color: '#22c55e' }}>■</span> Ingressos</span>
            <span><span style={{ color: '#ef4444' }}>■</span> Despeses</span>
            <span><span style={{ color: '#6366f1' }}>■</span> Balanç</span>
          </div>
        </div>
      )}

      {catData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Despeses per categoria</div>
          <div style={{ width: '100%', height: 240, marginBottom: 16 }}>
            <ResponsiveContainer>
              <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="55%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}
                  animationDuration={400}>
                  {catData.map((_, i) => { const c = getColors(); return <Cell key={i} fill={c[i % c.length]} /> })}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {catData.map((d, i) => (
            <div className="bar-row" key={d.name}>
              <span className="bar-label">{d.name}</span>
              <div className="bar-track">
                {(() => { const c = getColors(); return <div className="bar-fill" style={{ width: `${(d.value / maxCat) * 100}%`, background: c[i % c.length] }} /> })()}
              </div>
              <span className="bar-value">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="stats-title" style={{ marginBottom: 10 }}>Resum</div>
        {(() => {
          const balanc = totalIngresos - totalGastos
          const numMonths = period !== 'mes' ? Math.max(chartMonths.filter(ym => {
            const d = buildMonthData(filteredTxs, [ym])[0]
            return d.ingressos > 0 || d.gastos > 0
          }).length, 1) : null
          const rows = [
            { label: 'Total transaccions', value: filteredTxs.length },
            { label: 'Total ingressos', value: fmt(totalIngresos) },
            { label: 'Total despeses', value: fmt(totalGastos) },
            ...(numMonths ? [
              { label: 'Mitjana ingressos/mes', value: fmt(totalIngresos / numMonths) },
              { label: 'Mitjana despeses/mes', value: fmt(totalGastos / numMonths) },
            ] : []),
            { label: 'Balanç', value: fmt(balanc), color: balanc >= 0 ? 'var(--green)' : 'var(--red)' },
          ]
          return rows.map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ color: 'var(--text2)' }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: row.color || 'var(--text1)' }}>
                {row.label === 'Balanç' && balanc > 0 ? '+' : ''}{row.value}
              </span>
            </div>
          ))
        })()}
      </div>
    </div>
  )
}

function IngressosTab({ filteredTxs, chartMonths, period }) {
  const ingresos = filteredTxs.filter(t => t.tipo === 'ingreso')
  const allCats = [...new Set(ingresos.map(t => t.categoria).filter(Boolean))].sort()
  const [selectedCats, setSelectedCats] = useState([])

  const activeCats = selectedCats.length > 0 ? selectedCats : allCats

  const toggleCat = (cat) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  const byCat = groupBy(ingresos.filter(t => activeCats.includes(t.categoria)), 'categoria')
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  const maxCat = Math.max(...catData.map(d => d.value), 1)

  const monthData = period !== 'mes' ? buildIngressosByMonth(filteredTxs, chartMonths, activeCats) : []
  const total = catData.reduce((s, d) => s + d.value, 0)

  const COLORS = getColors()

  if (ingresos.length === 0) {
    return <p className="empty" style={{ marginTop: 24 }}>No hi ha ingressos en aquest període.</p>
  }

  return (
    <div>
      {/* Category filter chips */}
      {allCats.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allCats.map((cat, i) => (
            <button
              key={cat}
              className={`filter-chip ${selectedCats.includes(cat) ? 'active' : ''}`}
              style={selectedCats.includes(cat) ? { borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length], background: COLORS[i % COLORS.length] + '22' } : {}}
              onClick={() => toggleCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Bar chart by month */}
      {monthData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Ingressos per mes</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip
                  contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }}
                  formatter={(v, name) => [fmt(v), name]}
                />
                {activeCats.map((cat, i) => (
                  <Bar key={cat} dataKey={cat} stackId="ing" fill={COLORS[i % COLORS.length]} radius={i === activeCats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} animationDuration={400} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {activeCats.length > 1 && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6, flexWrap: 'wrap' }}>
              {activeCats.map((cat, i) => (
                <span key={cat}><span style={{ color: COLORS[i % COLORS.length] }}>■</span> {cat}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pie + bar breakdown */}
      {catData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Per categoria</div>
          {catData.length > 1 && (
            <div style={{ width: '100%', height: 200, marginBottom: 8 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    animationDuration={400}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {catData.length > 1 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12, marginBottom: 12 }}>
              {catData.map((d, i) => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                  {d.name} <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{((d.value / catData.reduce((s, x) => s + x.value, 0)) * 100).toFixed(0)}%</span>
                </span>
              ))}
            </div>
          )}
          {catData.map((d, i) => (
            <div className="bar-row" key={d.name}>
              <span className="bar-label">{d.name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(d.value / maxCat) * 100}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              <span className="bar-value">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
          <span style={{ color: 'var(--text2)' }}>Total ingressos</span>
          <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(total)}</span>
        </div>
        {period !== 'mes' && chartMonths.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
            <span style={{ color: 'var(--text2)' }}>Mitjana/mes</span>
            <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{fmt(total / Math.max(chartMonths.length, 1))}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Stats({ transactions }) {
  const now = new Date()
  const currentYear = String(now.getFullYear())
  const currentYM = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const years = [...new Set(transactions.map(t => t.fecha?.slice(0, 4)).filter(Boolean))].sort().reverse()
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const allYMs = [...new Set(transactions.map(t => t.fecha?.slice(0, 7)).filter(Boolean))].sort()

  const [period, setPeriod] = useState('ytd')
  const [selYear, setSelYear] = useState(currentYear)
  const [selMonth, setSelMonth] = useState(currentYM)
  const [subTab, setSubTab] = useState('despeses')

  let filteredTxs = transactions.filter(t => t.actiu !== false)
  let chartMonths = []

  if (period === 'any') {
    chartMonths = Array.from({ length: 12 }, (_, i) => `${selYear}-${String(i + 1).padStart(2, '0')}`)
    filteredTxs = transactions.filter(t => t.fecha?.startsWith(selYear))
  } else if (period === 'ytd') {
    const startYM = `${currentYear}-01`
    chartMonths = allYMs.filter(ym => ym >= startYM && ym <= currentYM)
    if (chartMonths.length === 0) {
      chartMonths = Array.from({ length: now.getMonth() + 1 }, (_, i) => `${currentYear}-${String(i + 1).padStart(2, '0')}`)
    }
    filteredTxs = transactions.filter(t => t.fecha?.startsWith(currentYear))
  } else {
    filteredTxs = transactions.filter(t => t.fecha?.slice(0, 7) === selMonth)
  }

  if (transactions.length === 0) {
    return <p className="empty">Afegeix transaccions per veure estadístiques.</p>
  }

  return (
    <div>
      <PeriodSelector
        period={period} setPeriod={setPeriod}
        selYear={selYear} setSelYear={setSelYear}
        selMonth={selMonth} setSelMonth={setSelMonth}
        years={years} allYMs={allYMs}
      />

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg3)', borderRadius: 10, padding: 3 }}>
        {[['despeses', 'Despeses'], ['ingressos', 'Ingressos']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setSubTab(v)}
            style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: subTab === v ? 'var(--bg2)' : 'transparent',
              color: subTab === v ? 'var(--text1)' : 'var(--text2)',
              boxShadow: subTab === v ? '0 1px 4px rgba(0,0,0,.18)' : 'none',
              transition: 'all .15s',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {subTab === 'despeses' && <DespesesTab filteredTxs={filteredTxs} chartMonths={chartMonths} period={period} />}
      {subTab === 'ingressos' && <IngressosTab filteredTxs={filteredTxs} chartMonths={chartMonths} period={period} />}
    </div>
  )
}
