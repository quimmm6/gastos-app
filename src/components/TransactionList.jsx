import { useState } from 'react'
import { deleteTransaction } from '../services/googleSheets'
import { fmtDate } from '../utils/dates'

const CAT_ICONS = {
  'Alimentación': '🛒', 'Transporte': '🚗', 'Ocio': '🎬', 'Salud': '💊',
  'Ropa': '👕', 'Casa': '🏠', 'Suscripciones': '📱', 'Restaurantes': '🍽️',
  'Viajes': '✈️', 'Trabajo': '💼', 'Otros': '📦', 'Nómina': '💵',
  'Inversiones': '📈', 'Regalo': '🎁',
}

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function TransactionList({ transactions, spreadsheetId, onDeleted, loading }) {
  const [filter, setFilter] = useState('todos')
  const [deleting, setDeleting] = useState(null)

  const filtered = transactions.filter(t => filter === 'todos' || t.tipo === filter)

  const handleDelete = async (tx) => {
    if (!confirm(`¿Eliminar "${tx.categoria} ${fmt(tx.importe)}"?`)) return
    setDeleting(tx.id)
    try {
      await deleteTransaction(spreadsheetId, tx.id)
      onDeleted(tx.id)
    } catch (e) {
      alert('Error al eliminar')
    } finally {
      setDeleting(null)
    }
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
          {filtered.length} registros
        </span>
      </div>

      {loading && <p className="empty">Cargando…</p>}
      {!loading && filtered.length === 0 && <p className="empty">No hay transacciones.</p>}

      <div className="recent-list">
        {filtered.map((tx) => (
          <div key={tx.id} className="tx-item">
            <span className="tx-icon">{CAT_ICONS[tx.categoria] || '💰'}</span>
            <div className="tx-info">
              <div className="tx-cat">{tx.categoria}</div>
              {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
              <div className="tx-date">{fmtDate(tx.fecha)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '-' : '+'}{fmt(tx.importe)}
              </span>
              <button
                className="btn-danger"
                onClick={() => handleDelete(tx)}
                disabled={deleting === tx.id}
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                {deleting === tx.id ? '…' : '🗑️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
