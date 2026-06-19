import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { fmtDate, currentYearMonth, monthName, toYearMonth } from '../utils/dates'

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function getLast13Months() {
  const result = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

export default function Dashboard({ transactions, loading, onRefresh, categories }) {
  const allMonths = getLast13Months()
  const [ym, setYm] = useState(currentYearMonth())

  const idx = allMonths.indexOf(ym)
  const canPrev = idx < allMonths.length - 1
  const canNext = idx > 0

  const monthly = transactions.filter(t => toYearMonth(t.fecha) === ym)
  const ingresos = monthly.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
  const gastos = monthly.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)
  const balance = ingresos - gastos

  const totalBalance = transactions.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
    - transactions.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  return (
    <div>
      <div className="month-nav">
        <button className="btn-icon" onClick={() => setYm(allMonths[idx + 1])} disabled={!canPrev}>
          <ChevronLeft size={20} />
        </button>
        <span className="month-label">{monthName(ym)}</span>
        <button className="btn-icon" onClick={() => setYm(allMonths[idx - 1])} disabled={!canNext}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="card balance-card">
        <div className="balance-label">Balanç del mes</div>
        <div className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>{fmt(balance)}</div>
        <div className="balance-row">
          <div className="balance-mini">
            <div className="label">Ingressos</div>
            <div className="value ing">{fmt(ingresos)}</div>
          </div>
          <div className="balance-mini">
            <div className="label">Despeses</div>
            <div className="value gas">{fmt(gastos)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>
          Acumulat total: <strong style={{ color: totalBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(totalBalance)}</strong>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-header">
          <span className="section-title">Transaccions del mes</span>
          <button className="btn-icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} style={{ opacity: loading ? 0.4 : 1 }} />
          </button>
        </div>

        {loading && <p className="empty">Carregant…</p>}
        {!loading && monthly.length === 0 && (
          <p className="empty">Sense transaccions a {monthName(ym)}.<br />Prem el botó + per afegir-ne.</p>
        )}

        <div className="recent-list">
          {monthly.slice(0, 10).map((tx) => (
            <div key={tx.id} className="tx-item">
              <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
              <div className="tx-info">
                <div className="tx-cat">{tx.categoria}</div>
                {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                <div className="tx-date">{fmtDate(tx.fecha)}</div>
              </div>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
