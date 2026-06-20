import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Pencil, X } from 'lucide-react'
import { deleteTransaction, updateTransaction, getRecurrents, updateRecurrent, deleteRecurrent, addRecurrent } from '../services/googleSheets'
import { fmtDate, fmtDateLong, parseImport } from '../utils/dates'
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

export function EditModal({ tx, categories, spreadsheetId, onSaved, onClose, onDelete, deletingId }) {
  const [form, setForm] = useState({ ...tx })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const cats = form.tipo === 'gasto' ? (categories?.gasto || []) : (categories?.ingreso || [])

  const handleSave = async () => {
    if (!form.importe || !form.categoria) { setError('Omple import i categoria'); return }
    setSaving(true); setError('')
    try {
      const updated = { ...form, importe: parseImport(form.importe) }
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
      {form.id?.startsWith('rec-') && (
        <div className="form-group"><label>Comptabilitzar</label>
          <div className="tipo-toggle">
            <button type="button" className={`tipo-btn ${form.actiu !== false ? 'active ingreso' : ''}`}
              onClick={() => setForm(f => ({ ...f, actiu: true }))}>Sí</button>
            <button type="button" className={`tipo-btn ${form.actiu === false ? 'active gasto' : ''}`}
              onClick={() => setForm(f => ({ ...f, actiu: false }))}>No</button>
          </div>
        </div>
      )}
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginBottom: 8 }}>
        {saving ? 'Desant…' : 'Desar canvis'}
      </button>
      {onDelete && (
        <button className="btn-ghost" style={{ width: '100%', color: 'var(--red)', borderColor: 'var(--red)' }}
          onClick={() => { onClose(); onDelete(tx) }} disabled={deletingId === tx.id}>
          Eliminar
        </button>
      )}
    </BottomSheet>,
    document.body
  )
}

const HIGH_DAYS = ['29', '30', '31']

function DiaInput({ value, onChange }) {
  const isP = value === 'P'
  const isU = value === 'U'
  const isSpecial = isP || isU
  const numVal = isSpecial ? (isU ? '31' : '1') : value
  const showWarning = HIGH_DAYS.includes(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={numVal} disabled={isSpecial}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, background: 'var(--bg3)',
            border: '1px solid var(--border)', color: isSpecial ? 'var(--text2)' : 'var(--text1)',
            borderRadius: 8, padding: '10px 12px', fontSize: 15, opacity: isSpecial ? 0.45 : 1,
            WebkitAppearance: 'none', appearance: 'none',
          }}>
          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(d => (
            <option key={d} value={d}>Dia {d}</option>
          ))}
        </select>
        {[['P', 'Primer'], ['U', 'Últim']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(value === v ? (v === 'P' ? '1' : '31') : v)}
            style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              background: value === v ? 'var(--accent)' : 'var(--bg3)',
              border: `1px solid ${value === v ? 'var(--accent)' : 'var(--border)'}`,
              color: value === v ? '#fff' : 'var(--text2)',
            }}>{l}</button>
        ))}
      </div>
      {isU && <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>S'adaptarà a l'últim dia de cada mes.</p>}
      {showWarning && !isSpecial && (
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
          ⚠️ Alguns mesos no tenen el dia {value}. Considera "Últim dia".
        </p>
      )}
    </div>
  )
}

function EditRecurrentModal({ rec, categories, spreadsheetId, onSaved, onDeleted, onClose, onUpdatePast, onDeletePast }) {
  const [form, setForm] = useState({ ...rec })
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState('edit')
  const [saveScope, setSaveScope] = useState('future')
  const [deleteScope, setDeleteScope] = useState('future')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const cats = form.tipo === 'gasto' ? (categories?.gasto || []) : (categories?.ingreso || [])
  const allCats = [...(categories?.gasto || []), ...(categories?.ingreso || [])]

  const handleSaveClick = () => {
    const categoriaChanged = form.categoria !== rec.categoria
    if (categoriaChanged) setStep('saveScope')
    else handleSaveDirectly()
  }
  const handleSaveDirectly = async () => {
    setSaving(true)
    try {
      const updated = { ...form, dia: String(form.dia), importe: parseImport(form.importe) }
      await updateRecurrent(spreadsheetId, updated)
      onSaved(updated)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const handleSaveConfirm = async () => {
    setSaving(true)
    try {
      const updated = { ...form, dia: parseInt(form.dia), importe: parseImport(form.importe) }
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
            <DiaInput value={String(form.dia)} onChange={v => setForm(f => ({ ...f, dia: v }))} />
          </div>
          <div className="form-group"><label>Data d'inici</label>
            <input type="date" value={form.inici} onChange={set('inici')} />
          </div>
          <div className="form-group"><label>Import (€)</label>
            <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" />
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
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={set('categoria')}>
              <option value="">Selecciona…</option>
              {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
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
  const [form, setForm] = useState({ dia: String(new Date().getDate()), inici: today(), importe: '', tipo: 'gasto', categoria: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const cats = form.tipo === 'gasto' ? (categories?.gasto || []) : (categories?.ingreso || [])

  const handleSave = async () => {
    if (!form.importe || !form.categoria) { setError('Omple import i categoria'); return }
    setSaving(true); setError('')
    try {
      await addRecurrent(spreadsheetId, { ...form, importe: parseImport(form.importe), activa: true })
      onAdded()
    } catch (e) { setError('Error en guardar'); console.error(e) }
    finally { setSaving(false) }
  }

  return createPortal(
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Nova recurrent</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="form-group"><label>Dia del mes</label>
        <DiaInput value={form.dia} onChange={v => setForm(f => ({ ...f, dia: v }))} />
      </div>
      <div className="form-group"><label>Data d'inici</label>
        <input type="date" value={form.inici} onChange={set('inici')} />
      </div>
      <div className="form-group"><label>Import (€)</label>
        <input type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} inputMode="decimal" placeholder="0,00" />
      </div>
      <div className="form-group"><label>Tipus</label>
        <div className="tipo-toggle">
          <button type="button" className={`tipo-btn ${form.tipo === 'gasto' ? 'active gasto' : ''}`}
            onClick={() => setForm(f => ({ ...f, tipo: 'gasto', categoria: '' }))}>🔴 Despesa</button>
          <button type="button" className={`tipo-btn ${form.tipo === 'ingreso' ? 'active ingreso' : ''}`}
            onClick={() => setForm(f => ({ ...f, tipo: 'ingreso', categoria: '' }))}>🟢 Ingrés</button>
        </div>
      </div>
      <div className="form-group"><label>Categoria</label>
        <select value={form.categoria} onChange={set('categoria')}>
          <option value="">Selecciona…</option>
          {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
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

export default function TransactionList({ transactions, spreadsheetId, onDeleted, onUpdated, loading, categories, readOnly }) {
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
  const catActive = !!catFilter

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
      <div className="filter-grid">
        {/* Fila 1: tipus */}
        {[['tots', 'Tots'], ['despesa', 'Despeses'], ['ingrés', 'Ingressos']].map(([v, l]) => (
          <button key={v} className={`filter-chip ${typeFilter === v ? 'active' : ''}`}
            onClick={() => { setTypeFilter(v); setCatFilter('') }}>{l}</button>
        ))}
        {/* Categories — span 2 files */}
        <select className={`filter-chip cat-btn ${catActive ? 'active' : ''}`} value={catFilter}
          onChange={e => setCatFilter(e.target.value)}>
          <option value="">Categories ▾</option>
          {availableCats.map(c => <option key={c} value={c}>{catMap[c] || ''} {c}</option>)}
        </select>
        {/* Fila 2: recurrència */}
        {[['tots', 'Tots'], ['ordinaris', 'Ordinaris'], ['recurrents', 'Recurrents']].map(([v, l]) => (
          <button key={v} className={`filter-chip secondary ${recFilter === v ? 'active secondary' : ''}`}
            onClick={() => setRecFilter(v)}>{l}</button>
        ))}
      </div>

      {loading && <p className="empty">Carregant…</p>}

      {isRecView ? (
        <div>
          {!readOnly && <button className="btn-primary" style={{ marginBottom: 12 }} onClick={() => setShowAddRec(true)}>
            + Afegir recurrent
          </button>}
          {recurrents.length === 0 && !loading && (
            <p className="empty">No hi ha {typeFilter === 'ingrés' ? 'ingressos' : typeFilter === 'despesa' ? 'despeses' : 'entrades'} recurrents.</p>
          )}
          <div className="recent-list">
            {recurrents.filter(rec =>
              typeFilter === 'tots' || (typeFilter === 'despesa' && rec.tipo === 'gasto') || (typeFilter === 'ingrés' && rec.tipo === 'ingreso')
            ).map((rec) => (
              <div key={rec.rowIndex} className="tx-item">
                <span className="tx-icon">{catMap[rec.categoria] || '🔁'}</span>
                <div className="tx-info">
                  <div className="tx-cat">{rec.categoria}</div>
                  {rec.descripcion && <div className="tx-desc">{rec.descripcion}</div>}
                  <div className="tx-date" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>
                      {rec.dia === 'P' ? 'Primer dia' : rec.dia === 'U' ? 'Últim dia' : `Dia ${rec.dia}`}
                      {' · '}
                      <span style={{ color: rec.activa ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {rec.activa ? 'Actiu' : 'No actiu'}
                      </span>
                    </span>
                    <span>Des del {fmtDateLong(rec.inici)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className="tx-amount gasto">−{fmt(rec.importe)}</span>
                  {!readOnly && <button onClick={() => setEditingRec(rec)}
                    style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer' }}>
                    <Pencil size={18} />
                  </button>}
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
              <div key={tx.id} className="tx-item" style={tx.actiu === false ? { opacity: 0.45 } : {}}>
                <span className="tx-icon">{catMap[tx.categoria] || '💰'}</span>
                <div className="tx-info">
                  <div className="tx-cat" style={tx.actiu === false ? { textDecoration: 'line-through' } : {}}>{tx.categoria}{tx.id.startsWith('rec-') ? ' 🔁' : ''}</div>
                  {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                  <div className="tx-date">{fmtDate(tx.fecha)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className={`tx-amount ${tx.tipo}`} style={tx.actiu === false ? { textDecoration: 'line-through' } : {}}>
                    {tx.tipo === 'gasto' ? '−' : '+'}{fmt(tx.importe)}
                  </span>
                  {!readOnly && <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => setEditing(tx)}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer' }}>
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(tx)} disabled={deleting === tx.id}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', padding: '4px 8px', cursor: 'pointer', opacity: deleting === tx.id ? 0.4 : 1 }}>
                      <Trash2 size={18} />
                    </button>
                  </div>}
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
