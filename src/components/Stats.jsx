import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#84cc16']

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

  let filteredTxs = transactions
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

  const gastos = filteredTxs.filter(t => t.tipo === 'gasto')
  const ingresos = filteredTxs.filter(t => t.tipo === 'ingreso')

  const byCat = groupBy(gastos, 'categoria')
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  const maxCat = Math.max(...catData.map(d => d.value), 1)

  const monthData = period !== 'mes' ? buildMonthData(filteredTxs, chartMonths) : []

  const totalIngresos = ingresos.reduce((s, t) => s + t.importe, 0)
  const totalGastos = gastos.reduce((s, t) => s + t.importe, 0)

  if (transactions.length === 0) {
    return <p className="empty">Afegeix transaccions per veure estadístiques.</p>
  }

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['ytd', 'Any actual'], ['any', 'Any natural'], ['mes', '1 mes']].map(([v, l]) => (
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
            {[...allYMs].reverse().map(ym => <option key={ym} value={ym}>{ym2label(ym)}</option>)}
          </select>
        )}
      </div>

      {/* Bar chart — monthly */}
      {monthData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Evolució mensual</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e42" />
                <XAxis dataKey="mes" tick={{ fill: '#9090b0', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9090b0', fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2e2e42', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [fmt(v), name === 'gastos' ? 'Despeses' : name === 'ingressos' ? 'Ingressos' : 'Balanç']}
                />
                <Bar dataKey="ingressos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="balanc" fill="#6366f1" radius={[4, 4, 0, 0]} />
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

      {/* Pie + bars by category */}
      {catData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Despeses per categoria</div>
          <div style={{ width: '100%', height: 200, marginBottom: 16 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1a1a24', border: '1px solid #2e2e42', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
        <div className="stats-title" style={{ marginBottom: 10 }}>Resum</div>
        {[
          { label: 'Total transaccions', value: filteredTxs.length },
          { label: 'Total ingressos', value: fmt(totalIngresos) },
          { label: 'Total despeses', value: fmt(totalGastos) },
          { label: 'Balanç', value: fmt(totalIngresos - totalGastos) },
          { label: 'Mitjana despesa', value: gastos.length ? fmt(totalGastos / gastos.length) : '—' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
            <span style={{ color: 'var(--text2)' }}>{row.label}</span>
            <span style={{ fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
