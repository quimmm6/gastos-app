import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Pencil, X, Check } from 'lucide-react'
import { deleteTransaction, updateTransaction } from '../services/googleSheets'
import { fmtDate } from '../utils/dates'
import BottomSheet from './BottomSheet'

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function EditModal({ tx, categories, spreadsheetId, onSaved, onClose }) {
  const [form, setForm] = useState({ ...tx })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const cats = form.tipo === 'gasto' ? (categories?.gasto || []) : (categories?.ingreso || [])

  const handleSave = async () => {
    if (!form.importe || !form.categoria) { setError('Omple import i categoria'); return }
    setSaving(true); setError('')
    try {
      const updated = { ...form, importe: parseFloat(form.importe) }
      await updateTransaction(spreadsheetId, updated)
      onSaved(updated)
    } catch (e) {
      setError('Error en guardar'); console.error(e)
    } finally { setSaving(false) }
  }

  return createPortal(
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Editar transacció</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="form-group">
        <label>Tipus</label>
        <div className="tipo-toggle">
          <button type="button" className={`tipo-btn ${form.tipo === 'gasto' ? 'active gasto' : ''}`}
            onClick={() => setForm(f => ({ ...f, tipo: 'gasto', categoria: '' }))}>🔴 Despesa</button>
          <button type="button" className={`tipo-btn ${form.tipo === 'ingreso' ? 'active ingreso' : ''}`}
            onClick={() => setForm(f => ({ ...f, tipo: 'ingreso', categoria: '' }))}>🟢 Ingrés</button>
        </div>
      </div>

      <div className="form-group">
        <label>Import (€)</label>
        <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" />
      </div>

      <div className="form-group">
        <label>Categoria</label>
        <select value={form.categoria} onChange={set('categoria')}>
          <option value="">Selecciona…</option>
          {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Data</label>
        <input type="date" value={form.fecha} onChange={set('fecha')} />
      </div>

      <div className="form-group">
        <label>Descripció</label>
        <textarea value={form.descripcion} onChange={set('descripcion')} />
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Desant…' : 'Desar canvis'}
      </button>
    </BottomSheet>,
    document.body
  )
}

export default function TransactionList({ transactions, spreadsheetId, onDeleted, onUpdated, loading, categories }) {
  const [filter, setFilter] = useState('tots')
  const [catFilter, setCatFilter] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  const typeFiltered = transactions.filter(t =>
    filter === 'tots' || (filter === 'despesa' && t.tipo === 'gasto') || (filter === 'ingrés' && t.tipo === 'ingreso')
  )
  const filtered = catFilter ? typeFiltered.filter(t => t.categoria === catFilter) : typeFiltered

  const availableCats = [...new Set(typeFiltered.map(t => t.categoria))].sort((a, b) => a.localeCompare(b, 'ca'))

  const handleDelete = async (tx) => {
    if (!confirm(`Eliminar "${tx.categoria} ${fmt(tx.importe)}"?`)) return
    setDeleting(tx.id)
    try {
      await deleteTransaction(spreadsheetId, tx.id)
      onDeleted(tx.id)
    } catch { alert('Error en eliminar') }
    finally { setDeleting(null) }
  }

  return (
    <div>
      <div className="filter-bar">
        {['tots', 'despesa', 'ingrés'].map(f => (
          <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setCatFilter('') }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>
          {filtered.length}
        </span>
      </div>
      <div className="filter-bar" style={{ marginTop: -6 }}>
        <button className={`filter-chip ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>Totes</button>
        {availableCats.map(c => (
          <button key={c} className={`filter-chip ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
            {catMap[c] || ''} {c}
          </button>
        ))}
      </div>

      {loading && <p className="empty">Carregant…</p>}
      {!loading && filtered.length === 0 && <p className="empty">No hi ha transaccions.</p>}

      <div className="recent-list">
        {filtered.map((tx) => (
          <div key={tx.id} className="tx-item">
            <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
            <div className="tx-info">
              <div className="tx-cat">{tx.categoria}</div>
              {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
              <div className="tx-date">{fmtDate(tx.fecha)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setEditing(tx)}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: 3, cursor: 'pointer' }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(tx)} disabled={deleting === tx.id}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: 3, cursor: 'pointer', opacity: deleting === tx.id ? 0.4 : 1 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditModal
          tx={editing}
          categories={categories}
          spreadsheetId={spreadsheetId}
          onSaved={(updated) => { onUpdated(updated); setEditing(null) }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
