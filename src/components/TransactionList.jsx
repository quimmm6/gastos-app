import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Pencil, X } from 'lucide-react'
import { deleteTransaction, updateTransaction, getRecurrents, updateRecurrent, deleteRecurrent, addRecurrent } from '../services/googleSheets'
import { fmtDate } from '../utils/dates'
import BottomSheet from './BottomSheet'

function fmt(n) {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

function today() { return new Date().toISOString().split('T')[0] }

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
    } catch (e) { setError('Error en guardar'); console.error(e) }
    finally { setSaving(false) }
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
      <div className="form-group"><label>Import (€)</label>
        <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" />
      </div>
      <div className="form-group"><label>Categoria</label>
        <select value={form.categoria} onChange={set('categoria')}>
          <option value="">Selecciona…</option>
          {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div className="form-group"><label>Data</label>
        <input type="date" value={form.fecha} onChange={set('fecha')} />
      </div>
      <div className="form-group"><label>Descripció</label>
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

function EditRecurrentModal({ rec, categories, spreadsheetId, onSaved, onDeleted, onClose, transactions, onDeletePast }) {
  const [form, setForm] = useState({ ...rec })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteScope, setDeleteScope] = useState('all')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const allCats = [...(categories?.gasto || []), ...(categories?.ingreso || [])]

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = { ...form, dia: parseInt(form.dia), importe: parseFloat(form.importe) }
      await updateRecurrent(spreadsheetId, updated)
      onSaved(updated)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      if (deleteScope === 'past') {
        // Delete past registre entries for this recurrent
        await onDeletePast(rec)
      }
      await deleteRecurrent(spreadsheetId, rec.rowIndex)
      onDeleted(rec.rowIndex)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return createPortal(
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Editar recurrent</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} /></button>
      </div>

      {confirmDelete ? (
        <div>
          <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--text1)' }}>Vols eliminar també les entrades passades al Registre?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[['future', 'No, només deixar d\'aplicar-se'], ['past', 'Sí, eliminar registres anteriors']].map(([v, l]) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" value={v} checked={deleteScope === v} onChange={() => setDeleteScope(v)} />
                {l}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel·lar</button>
            <button className="btn-primary" style={{ flex: 1, background: 'var(--red)' }} onClick={handleDelete} disabled={saving}>
              {saving ? 'Eliminant…' : 'Eliminar'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="form-group"><label>Dia del mes</label>
            <input type="number" min="1" max="31" value={form.dia} onChange={set('dia')} />
          </div>
          <div className="form-group"><label>Data d'inici</label>
            <input type="date" value={form.inici} onChange={set('inici')} />
          </div>
          <div className="form-group"><label>Import (€)</label>
            <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" />
          </div>
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={set('categoria')}>
              <option value="">Selecciona…</option>
              {allCats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Descripció</label>
            <textarea value={form.descripcion} onChange={set('descripcion')} />
          </div>
          <div className="form-group"><label>Activa</label>
            <div className="tipo-toggle">
              <button type="button" className={`tipo-btn ${form.activa ? 'active ingreso' : ''}`} onClick={() => setForm(f => ({ ...f, activa: true }))}>Sí</button>
              <button type="button" className={`tipo-btn ${!form.activa ? 'active gasto' : ''}`} onClick={() => setForm(f => ({ ...f, activa: false }))}>No</button>
            </div>
          </div>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginBottom: 8 }}>
            {saving ? 'Desant…' : 'Desar canvis'}
          </button>
          <button className="btn-ghost" style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => setConfirmDelete(true)}>
            Eliminar recurrent
          </button>
        </>
      )}
    </BottomSheet>,
    document.body
  )
}

function AddRecurrentModal({ categories, spreadsheetId, onAdded, onClose }) {
  const [form, setForm] = useState({ dia: new Date().getDate(), inici: today(), importe: '', categoria: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const allCats = [...(categories?.gasto || []), ...(categories?.ingreso || [])]

  const handleSave = async () => {
    if (!form.importe || !form.categoria) { setError('Omple import i categoria'); return }
    setSaving(true); setError('')
    try {
      const rec = { ...form, dia: parseInt(form.dia), importe: parseFloat(form.importe), activa: true }
      await addRecurrent(spreadsheetId, rec)
      onAdded()
    } catch (e) { setError('Error en guardar'); console.error(e) }
    finally { setSaving(false) }
  }

  return createPortal(
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Nova despesa recurrent</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="form-group"><label>Dia del mes</label>
        <input type="number" min="1" max="31" value={form.dia} onChange={set('dia')} />
      </div>
      <div className="form-group"><label>Data d'inici</label>
        <input type="date" value={form.inici} onChange={set('inici')} />
      </div>
      <div className="form-group"><label>Import (€)</label>
        <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" placeholder="0,00" />
      </div>
      <div className="form-group"><label>Categoria</label>
        <select value={form.categoria} onChange={set('categoria')}>
          <option value="">Selecciona…</option>
          {allCats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div className="form-group"><label>Descripció (opcional)</label>
        <textarea value={form.descripcion} onChange={set('descripcion')} placeholder="Ex: Netflix…" />
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Desant…' : 'Afegir recurrent'}
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
  const [recurrents, setRecurrents] = useState([])
  const [editingRec, setEditingRec] = useState(null)
  const [showAddRec, setShowAddRec] = useState(false)

  useEffect(() => {
    if (filter === 'recurrents') {
      getRecurrents(spreadsheetId).then(setRecurrents)
    }
  }, [filter, spreadsheetId])

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

  const handleDeletePast = async (rec) => {
    // Delete all Registre entries matching this recurrent's categoria+descripcion
    const toDelete = transactions.filter(t =>
      t.categoria === rec.categoria && t.descripcion === rec.descripcion && t.id.startsWith('rec-')
    )
    for (const tx of toDelete) {
      try { await deleteTransaction(spreadsheetId, tx.id); onDeleted(tx.id) } catch {}
    }
  }

  const isRecurrentView = filter === 'recurrents'

  return (
    <div>
      <div className="filter-bar">
        {[['tots', 'Tots'], ['despesa', 'Despeses'], ['ingrés', 'Ingressos'], ['recurrents', '🔁']].map(([v, l]) => (
          <button key={v} className={`filter-chip ${filter === v ? 'active' : ''}`}
            onClick={() => { setFilter(v); setCatFilter('') }}>{l}</button>
        ))}
        {!isRecurrentView && (
          <select className={`filter-select ${catFilter ? 'active-filter' : ''}`} value={catFilter}
            onChange={e => setCatFilter(e.target.value)} style={{ marginLeft: 'auto', flexShrink: 1 }}>
            <option value="">Categoria ▾</option>
            {availableCats.map(c => <option key={c} value={c}>{catMap[c] || ''} {c}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
          {isRecurrentView ? recurrents.length : filtered.length}
        </span>
      </div>

      {loading && <p className="empty">Carregant…</p>}

      {isRecurrentView ? (
        <div>
          <button className="btn-primary" style={{ marginBottom: 12 }} onClick={() => setShowAddRec(true)}>
            + Afegir recurrent
          </button>
          {recurrents.length === 0 && !loading && <p className="empty">No hi ha despeses recurrents.</p>}
          <div className="recent-list">
            {recurrents.map((rec) => (
              <div key={rec.rowIndex} className="tx-item">
                <span className="tx-icon">{catMap[rec.categoria] || '🔁'}</span>
                <div className="tx-info">
                  <div className="tx-cat">{rec.categoria}</div>
                  {rec.descripcion && <div className="tx-desc">{rec.descripcion}</div>}
                  <div className="tx-date">Dia {rec.dia} · des de {rec.inici} · {rec.activa ? '✅ activa' : '⏸ inactiva'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className="tx-amount gasto">−{fmt(rec.importe)}</span>
                  <button onClick={() => setEditingRec(rec)}
                    style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer' }}>
                    <Pencil size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {!loading && filtered.length === 0 && <p className="empty">No hi ha transaccions.</p>}
          <div className="recent-list">
            {filtered.map((tx) => (
              <div key={tx.id} className="tx-item">
                <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
                <div className="tx-info">
                  <div className="tx-cat">{tx.categoria}{tx.id.startsWith('rec-') ? ' 🔁' : ''}</div>
                  {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                  <div className="tx-date">{fmtDate(tx.fecha)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className={`tx-amount ${tx.tipo}`}>
                    {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
                  </span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setEditing(tx)}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer' }}>
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(tx)} disabled={deleting === tx.id}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer', opacity: deleting === tx.id ? 0.4 : 1 }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditModal tx={editing} categories={categories} spreadsheetId={spreadsheetId}
          onSaved={(updated) => { onUpdated(updated); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}

      {editingRec && (
        <EditRecurrentModal rec={editingRec} categories={categories} spreadsheetId={spreadsheetId}
          transactions={transactions}
          onSaved={(updated) => { setRecurrents(r => r.map(x => x.rowIndex === updated.rowIndex ? updated : x)); setEditingRec(null) }}
          onDeleted={(rowIndex) => { setRecurrents(r => r.filter(x => x.rowIndex !== rowIndex)); setEditingRec(null) }}
          onDeletePast={handleDeletePast}
          onClose={() => setEditingRec(null)} />
      )}

      {showAddRec && (
        <AddRecurrentModal categories={categories} spreadsheetId={spreadsheetId}
          onAdded={() => { setShowAddRec(false); getRecurrents(spreadsheetId).then(setRecurrents) }}
          onClose={() => setShowAddRec(false)} />
      )}
    </div>
  )
}
