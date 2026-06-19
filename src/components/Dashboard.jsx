import { ChevronLeft, ChevronRight, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { fmtDate, currentYearMonth, monthName, toYearMonth } from '../utils/dates'

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function getAvailableMonths(transactions) {
  const set = new Set(transactions.map(t => t.fecha?.slice(0, 7)).filter(Boolean))
  set.add(currentYearMonth())
  return [...set].sort().reverse()
}

export default function Dashboard({ transactions, loading, onRefresh, categories }) {
  const allMonths = getAvailableMonths(transactions)
  const [ym, setYm] = useState(currentYearMonth())
  const [hideTotal, setHideTotal] = useState(true)

  const safeYm = allMonths.includes(ym) ? ym : (allMonths[0] || currentYearMonth())
  const idx = allMonths.indexOf(safeYm)
  const canPrev = idx < allMonths.length - 1
  const canNext = idx > 0

  const monthly = transactions.filter(t => toYearMonth(t.fecha) === safeYm)
  const ingresos = monthly.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
  const gastos = monthly.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)
  const balance = ingresos - gastos

  const year = safeYm.slice(0, 4)
  const yearTxs = transactions.filter(t => t.fecha?.startsWith(year))
  const yearBalance = yearTxs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
    - yearTxs.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  return (
    <div>
      <div className="month-nav">
        <button className="btn-icon" onClick={() => setYm(allMonths[idx + 1])} disabled={!canPrev}>
          <ChevronLeft size={20} />
        </button>
        <span className="month-label">{monthName(safeYm)}</span>
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
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          Acumulat {year}:&nbsp;
          {hideTotal
            ? <strong>*****</strong>
            : <strong style={{ color: yearBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(yearBalance)}</strong>
          }
          <button onClick={() => setHideTotal(h => !h)}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {hideTotal ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
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
          <p className="empty">Sense transaccions a {monthName(safeYm)}.<br />Prem el botó + per afegir-ne.</p>
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
