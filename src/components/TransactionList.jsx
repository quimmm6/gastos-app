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

const SCOPE_OPTS = [
  ['future', 'No, només a partir d\'ara'],
  ['past', 'Sí, modificar/eliminar registres anteriors'],
]

function ScopeSelector({ value, onChange, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {SCOPE_OPTS.map(([v, l]) => (
        <button key={v} type="button"
          onClick={() => onChange(v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
            background: value === v ? 'var(--accent)' : 'var(--bg3)',
            border: `2px solid ${value === v ? 'var(--accent)' : 'var(--border)'}`,
            color: value === v ? '#fff' : 'var(--text1)', fontSize: 14, fontWeight: value === v ? 600 : 400,
          }}>
          <span style={{ fontSize: 18 }}>{value === v ? '●' : '○'}</span>
          {l}
        </button>
      ))}
    </div>
  )
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

function EditRecurrentModal({ rec, categories, spreadsheetId, onSaved, onDeleted, onClose, onUpdatePast, onDeletePast }) {
  const [form, setForm] = useState({ ...rec })
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('edit') // 'edit' | 'saveScope' | 'deleteScope'
  const [saveScope, setSaveScope] = useState('future')
  const [deleteScope, setDeleteScope] = useState('future')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const allCats = [...(categories?.gasto || []), ...(categories?.ingreso || [])]

  const handleSaveClick = () => setStep('saveScope')

  const handleSaveConfirm = async () => {
    setSaving(true)
    try {
      const updated = { ...form, dia: parseInt(form.dia), importe: parseFloat(form.importe) }
      await updateRecurrent(spreadsheetId, updated)
      if (saveScope === 'past') await onUpdatePast(rec, updated)
      onSaved(updated)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleDeleteConfirm = async () => {
    setSaving(true)
    try {
      if (deleteScope === 'past') await onDeletePast(rec)
      await deleteRecurrent(spreadsheetId, rec.rowIndex)
      onDeleted(rec.rowIndex)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  return createPortal(
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>
          {step === 'edit' ? 'Editar recurrent' : step === 'saveScope' ? 'Desar canvis' : 'Eliminar recurrent'}
        </h2>
        <button className="btn-icon" onClick={step === 'edit' ? onClose : () => setStep('edit')}><X size={20} /></button>
      </div>

      {step === 'edit' && (
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
          <button className="btn-primary" onClick={handleSaveClick} style={{ marginBottom: 8 }}>Desar canvis</button>
          <button className="btn-ghost" style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => setStep('deleteScope')}>Eliminar recurrent</button>
        </>
      )}

      {step === 'saveScope' && (
        <>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>Els canvis d'import o categoria, vols aplicar-los als registres anteriors generats per aquesta recurrent?</p>
          <ScopeSelector value={saveScope} onChange={setSaveScope} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('edit')}>Enrere</button>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveConfirm} disabled={saving}>
              {saving ? 'Desant…' : 'Confirmar'}
            </button>
          </div>
        </>
      )}

      {step === 'deleteScope' && (
        <>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>Vols eliminar també els registres anteriors generats per aquesta recurrent?</p>
          <ScopeSelector value={deleteScope} onChange={setDeleteScope} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('edit')}>Enrere</button>
            <button className="btn-primary" style={{ flex: 1, background: 'var(--red)' }} onClick={handleDeleteConfirm} disabled={saving}>
              {saving ? 'Eliminant…' : 'Eliminar'}
            </button>
          </div>
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
      await addRecurrent(spreadsheetId, { ...form, dia: parseInt(form.dia), importe: parseFloat(form.importe), activa: true })
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
  const [typeFilter, setTypeFilter] = useState('tots')
  const [recFilter, setRecFilter] = useState('tots')
  const [catFilter, setCatFilter] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [editing, setEditing] = useState(null)
  const [recurrents, setRecurrents] = useState([])
  const [editingRec, setEditingRec] = useState(null)
  const [showAddRec, setShowAddRec] = useState(false)

  const isRecView = recFilter === 'recurrents'

  useEffect(() => {
    if (isRecView) getRecurrents(spreadsheetId).then(setRecurrents)
  }, [isRecView, spreadsheetId])

  const catMap = {}
  ;[...(categories?.gasto || []), ...(categories?.ingreso || [])].forEach(c => { catMap[c.name] = c.icon })

  const typeFiltered = transactions.filter(t =>
    typeFilter === 'tots' || (typeFilter === 'despesa' && t.tipo === 'gasto') || (typeFilter === 'ingrés' && t.tipo === 'ingreso')
  )
  const recFiltered = typeFiltered.filter(t =>
    recFilter === 'tots' || (recFilter === 'ordinaris' && !t.id.startsWith('rec-')) || (recFilter === 'recurrents' && t.id.startsWith('rec-'))
  )
  const filtered = catFilter ? recFiltered.filter(t => t.categoria === catFilter) : recFiltered
  const availableCats = [...new Set(typeFiltered.map(t => t.categoria))].sort((a, b) => a.localeCompare(b, 'ca'))

  const handleDelete = async (tx) => {
    if (!confirm(`Eliminar "${tx.categoria} ${fmt(tx.importe)}"?`)) return
    setDeleting(tx.id)
    try { await deleteTransaction(spreadsheetId, tx.id); onDeleted(tx.id) }
    catch { alert('Error en eliminar') }
    finally { setDeleting(null) }
  }

  const handleDeletePast = async (rec) => {
    const toDelete = transactions.filter(t =>
      t.categoria === rec.categoria && t.descripcion === rec.descripcion && t.id.startsWith('rec-')
    )
    for (const tx of toDelete) {
      try { await deleteTransaction(spreadsheetId, tx.id); onDeleted(tx.id) } catch {}
    }
  }

  const handleUpdatePast = async (oldRec, newRec) => {
    const toUpdate = transactions.filter(t =>
      t.categoria === oldRec.categoria && t.descripcion === oldRec.descripcion && t.id.startsWith('rec-')
    )
    for (const tx of toUpdate) {
      try {
        const updated = { ...tx, categoria: newRec.categoria, importe: newRec.importe, descripcion: newRec.descripcion }
        await updateTransaction(spreadsheetId, updated)
        onUpdated(updated)
      } catch {}
    }
  }

  return (
    <div>
      {/* Fila 1: tipus */}
      <div className="filter-bar" style={{ marginBottom: 6 }}>
        {[['tots', 'Tots'], ['despesa', 'Despeses'], ['ingrés', 'Ingressos']].map(([v, l]) => (
          <button key={v} className={`filter-chip ${typeFilter === v ? 'active' : ''}`}
            onClick={() => { setTypeFilter(v); setCatFilter('') }}>{l}</button>
        ))}
        <select className={`filter-select ${catFilter ? 'active-filter' : ''}`} value={catFilter}
          onChange={e => setCatFilter(e.target.value)} style={{ marginLeft: 'auto', flexShrink: 1 }}>
          <option value="">Categories ▾</option>
          {availableCats.map(c => <option key={c} value={c}>{catMap[c] || ''} {c}</option>)}
        </select>
      </div>

      {/* Fila 2: recurrència */}
      <div className="filter-bar" style={{ marginBottom: 12, paddingTop: 0 }}>
        {[['tots', 'Tots'], ['ordinaris', 'Ordinaris'], ['recurrents', 'Recurrents']].map(([v, l]) => (
          <button key={v} className={`filter-chip ${recFilter === v ? 'active' : ''}`}
            onClick={() => setRecFilter(v)}>{l}</button>
        ))}
      </div>

      {loading && <p className="empty">Carregant…</p>}

      {isRecView ? (
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
                  <div className="tx-date">Dia {rec.dia} · des de {rec.inici} · {rec.activa ? '✅' : '⏸'}</div>
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
          onSaved={(u) => { onUpdated(u); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}

      {editingRec && (
        <EditRecurrentModal rec={editingRec} categories={categories} spreadsheetId={spreadsheetId}
          transactions={transactions}
          onSaved={(u) => { setRecurrents(r => r.map(x => x.rowIndex === u.rowIndex ? u : x)); setEditingRec(null) }}
          onDeleted={(ri) => { setRecurrents(r => r.filter(x => x.rowIndex !== ri)); setEditingRec(null) }}
          onUpdatePast={handleUpdatePast}
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
