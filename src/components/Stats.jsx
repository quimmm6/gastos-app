import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#84cc16']

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function groupBy(txs, key) {
  return txs.reduce((acc, tx) => {
    acc[tx[key]] = (acc[tx[key]] || 0) + tx.importe
    return acc
  }, {})
}

function monthLabel(dateStr) {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('-')
  return `${m}/${y?.slice(2)}`
}

export default function Stats({ transactions }) {
  if (transactions.length === 0) {
    return <p className="empty">Añade transacciones para ver estadísticas.</p>
  }

  const gastos = transactions.filter(t => t.tipo === 'gasto')
  const ingresos = transactions.filter(t => t.tipo === 'ingreso')

  // Por categoría (gastos)
  const byCat = groupBy(gastos, 'categoria')
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  const maxCat = Math.max(...catData.map(d => d.value), 1)

  // Por mes
  const byMonth = {}
  transactions.forEach(tx => {
    const m = tx.fecha?.slice(0, 7) || ''
    if (!byMonth[m]) byMonth[m] = { mes: monthLabel(tx.fecha), gastos: 0, ingresos: 0 }
    byMonth[m][tx.tipo === 'gasto' ? 'gastos' : 'ingresos'] += tx.importe
  })
  const monthData = Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6)

  return (
    <div>
      {/* Gráfico de barras mensual */}
      <div className="stats-section">
        <div className="stats-title">Evolución mensual (últimos 6 meses)</div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={monthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2e42" />
              <XAxis dataKey="mes" tick={{ fill: '#9090b0', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9090b0', fontSize: 10 }} tickFormatter={v => `${v}€`} />
              <Tooltip
                contentStyle={{ background: '#1a1a24', border: '1px solid #2e2e42', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [fmt(v), name === 'gastos' ? 'Gastos' : 'Ingresos']}
              />
              <Bar dataKey="ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gastos por categoría */}
      {catData.length > 0 && (
        <div className="stats-section">
          <div className="stats-title">Gastos por categoría</div>
          <div style={{ width: '100%', height: 200, marginBottom: 16 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
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

      {/* Resumen numérico */}
      <div className="card">
        <div className="stats-title" style={{ marginBottom: 10 }}>Resumen total</div>
        {[
          { label: 'Total transacciones', value: transactions.length },
          { label: 'Total gastos', value: fmt(gastos.reduce((s, t) => s + t.importe, 0)) },
          { label: 'Total ingresos', value: fmt(ingresos.reduce((s, t) => s + t.importe, 0)) },
          { label: 'Media gasto', value: gastos.length ? fmt(gastos.reduce((s, t) => s + t.importe, 0) / gastos.length) : '—' },
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
