import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteTransaction } from '../services/googleSheets'
import { fmtDate } from '../utils/dates'

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function TransactionList({ transactions, spreadsheetId, onDeleted, loading, categories }) {
  const [filter, setFilter] = useState('todos')
  const [deleting, setDeleting] = useState(null)

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  const filtered = transactions.filter(t => filter === 'todos' || t.tipo === filter)

  const handleDelete = async (tx) => {
    if (!confirm(`¿Eliminar "${tx.categoria} ${fmt(tx.importe)}"?`)) return
    setDeleting(tx.id)
    try {
      await deleteTransaction(spreadsheetId, tx.id)
      onDeleted(tx.id)
    } catch { alert('Error al eliminar') }
    finally { setDeleting(null) }
  }

  return (
    <div>
      <div className="filter-bar">
        {['todos', 'gasto', 'ingreso'].map(f => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>
          {filtered.length}
        </span>
      </div>

      {loading && <p className="empty">Cargando…</p>}
      {!loading && filtered.length === 0 && <p className="empty">No hay transacciones.</p>}

      <div className="recent-list">
        {filtered.map((tx) => (
          <div key={tx.id} className="tx-item">
            <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
            <div className="tx-info">
              <div className="tx-cat">{tx.categoria}</div>
              {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
              <div className="tx-date">{fmtDate(tx.fecha)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
              </span>
              <button
                onClick={() => handleDelete(tx)}
                disabled={deleting === tx.id}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: 2, cursor: 'pointer', opacity: deleting === tx.id ? 0.4 : 1 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
