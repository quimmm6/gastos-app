import { useState } from 'react'
import { fmtDate, currentYearMonth, monthName, toYearMonth } from '../utils/dates'

const CAT_ICONS = {
  'Alimentación': '🛒', 'Transporte': '🚗', 'Ocio': '🎬', 'Salud': '💊',
  'Ropa': '👕', 'Casa': '🏠', 'Suscripciones': '📱', 'Restaurantes': '🍽️',
  'Viajes': '✈️', 'Trabajo': '💼', 'Otros': '📦', 'Nómina': '💵',
  'Inversiones': '📈', 'Regalo': '🎁',
}

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function Dashboard({ transactions, loading, onRefresh }) {
  const [ym, setYm] = useState(currentYearMonth())

  // Meses disponibles
  const months = [...new Set(transactions.map(t => toYearMonth(t.fecha)).filter(Boolean))].sort().reverse()
  if (months.length > 0 && !months.includes(ym)) setYm(months[0])

  const monthly = transactions.filter(t => toYearMonth(t.fecha) === ym)
  const ingresos = monthly.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
  const gastos = monthly.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)
  const balance = ingresos - gastos

  const totalBalance = transactions.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
    - transactions.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)

  const recent = monthly.slice(0, 8)

  return (
    <div>
      {/* Selector de mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn-ghost small" onClick={() => {
          const idx = months.indexOf(ym)
          if (idx < months.length - 1) setYm(months[idx + 1])
        }} disabled={months.indexOf(ym) >= months.length - 1}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{monthName(ym)}</span>
        <button className="btn-ghost small" onClick={() => {
          const idx = months.indexOf(ym)
          if (idx > 0) setYm(months[idx - 1])
        }} disabled={months.indexOf(ym) <= 0}>›</button>
      </div>

      <div className="card balance-card">
        <div className="balance-label">Balance del mes</div>
        <div className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
          {fmt(balance)}
        </div>
        <div className="balance-row">
          <div className="balance-mini">
            <div className="label">Ingresos</div>
            <div className="value ing">{fmt(ingresos)}</div>
          </div>
          <div className="balance-mini">
            <div className="label">Gastos</div>
            <div className="value gas">{fmt(gastos)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
          Balance total acumulado: <strong style={{ color: totalBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(totalBalance)}</strong>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-header">
          <span className="section-title">Transacciones del mes</span>
          <button className="btn-ghost small" onClick={onRefresh} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
        </div>

        {loading && <p className="empty">Cargando…</p>}
        {!loading && recent.length === 0 && <p className="empty">Sin transacciones este mes.<br />Pulsa ➕ para añadir.</p>}

        <div className="recent-list">
          {recent.map((tx) => (
            <div key={tx.id} className="tx-item">
              <span className="tx-icon">{CAT_ICONS[tx.categoria] || '💰'}</span>
              <div className="tx-info">
                <div className="tx-cat">{tx.categoria}</div>
                {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                <div className="tx-date">{fmtDate(tx.fecha)}</div>
              </div>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '-' : '+'}{fmt(tx.importe)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
