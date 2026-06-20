import { ChevronLeft, ChevronRight, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { useState, useRef } from 'react'
import { fmtDate, currentYearMonth, monthName, toYearMonth } from '../utils/dates'
import { EditModal } from './TransactionList'
import { deleteTransaction } from '../services/googleSheets'

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function getAvailableMonths(transactions) {
  const set = new Set(transactions.map(t => t.fecha?.slice(0, 7)).filter(Boolean))
  set.add(currentYearMonth())
  return [...set].sort().reverse()
}

export default function Dashboard({ transactions, loading, onRefresh, categories, spreadsheetId, onDeleted, onUpdated }) {
  const allMonths = getAvailableMonths(transactions)
  const [ym, setYm] = useState(currentYearMonth())
  const [hideTotal, setHideTotal] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [monthAnimKey, setMonthAnimKey] = useState(0)
  const [monthSlideDir, setMonthSlideDir] = useState('left')

  const safeYm = allMonths.includes(ym) ? ym : (allMonths[0] || currentYearMonth())
  const idx = allMonths.indexOf(safeYm)
  const canPrev = idx < allMonths.length - 1
  const canNext = idx > 0

  const monthly = transactions.filter(t => toYearMonth(t.fecha) === safeYm)
  const monthlyActive = monthly.filter(t => t.actiu !== false)
  const ingresos = monthlyActive.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
  const gastos = monthlyActive.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)
  const balance = ingresos - gastos

  const year = safeYm.slice(0, 4)
  const yearTxs = transactions.filter(t => t.fecha?.startsWith(year) && t.actiu !== false)
  const yearBalance = yearTxs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
    - yearTxs.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  const handleDelete = async (tx) => {
    if (!confirm(`Eliminar "${tx.categoria} ${fmt(tx.importe)}"?`)) return
    setDeleting(tx.id)
    try { await deleteTransaction(spreadsheetId, tx.id); onDeleted(tx.id) }
    catch { alert('Error en eliminar') }
    finally { setDeleting(null) }
  }

  const swipeStartX = useRef(null)
  const goMonth = (newYm, dir) => { setMonthSlideDir(dir); setMonthAnimKey(k => k + 1); setYm(newYm); setShowAll(false) }
  const onTouchStart = (e) => { swipeStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0 && canNext) goMonth(allMonths[idx - 1], 'left')
    if (dx > 0 && canPrev) goMonth(allMonths[idx + 1], 'right')
  }

  return (
    <div>
      <div className="month-nav">
        <button className="btn-icon" onClick={() => goMonth(allMonths[idx + 1], 'right')} disabled={!canPrev}>
          <ChevronLeft size={20} />
        </button>
        <span className="month-label">{monthName(safeYm)}</span>
        <button className="btn-icon" onClick={() => goMonth(allMonths[idx - 1], 'left')} disabled={!canNext}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div key={monthAnimKey} className={`page-slide page-slide-${monthSlideDir}`}>
      <div className="card balance-card" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ touchAction: 'pan-y' }}>
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
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div className="balance-label" style={{ margin: 0 }}>Balanç del mes</div>
          <div className={`balance-amount ${balance < 0 ? 'negative' : ''}`}>{fmt(balance)}</div>
        </div>
        <div className="balance-accumulated">
          <span>Acumulat {year}:</span>
          {hideTotal
            ? <strong>*****</strong>
            : <strong style={{ color: yearBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(yearBalance)}</strong>
          }
          <button onClick={() => setHideTotal(h => !h)}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 1 }}>
            {hideTotal ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
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
          {(showAll ? monthly : monthly.slice(0, 10)).map((tx) => (
            <div key={tx.id} className="tx-item" style={tx.actiu === false ? { opacity: 0.45 } : {}}
              onClick={() => setEditing(tx)}>
              <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
              <div className="tx-info">
                <div className="tx-cat" style={tx.actiu === false ? { textDecoration: 'line-through' } : {}}>{tx.categoria}</div>
                {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                <div className="tx-date">{fmtDate(tx.fecha)}</div>
              </div>
              <span className={`tx-amount ${tx.tipo}`} style={tx.actiu === false ? { textDecoration: 'line-through' } : {}}>
                {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
              </span>
            </div>
          ))}
        </div>
        {!showAll && monthly.length > 10 && (
          <button onClick={() => setShowAll(true)}
            style={{ width: '100%', marginTop: 10, padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
            Mostra-les totes ({monthly.length})
          </button>
        )}
      </div>

      {editing && (
        <EditModal tx={editing} categories={categories} spreadsheetId={spreadsheetId}
          onSaved={(u) => { onUpdated(u); setEditing(null) }}
          onClose={() => setEditing(null)}
          onDelete={handleDelete}
          deletingId={deleting} />
      )}
    </div>
  )
}
