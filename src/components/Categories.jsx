import { useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { reassignCategory } from '../services/googleSheets'

const EMOJI_OPTIONS = [
  '🛒','🚗','🎬','💊','👕','🏠','📱','🍽️','✈️','📦','💵','💼','📈','🎁',
  '🐶','🍕','☕','🎵','📚','🏋️','🎮','💐','🧴','🧹','⚡','🌊','🍺','🎂',
  '🏥','🚌','🚲','🛵','🏖️','🎁','💻','🖥️','📷','👶','🧒','👓','🎓','🏫',
]

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ fontSize: 24, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
        {value || '📦'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 44, left: 0, zIndex: 100,
          background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 10, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, width: 240,
          boxShadow: '0 8px 24px rgba(0,0,0,.5)'
        }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} type="button"
              onClick={() => { onChange(e); setOpen(false) }}
              style={{ fontSize: 20, background: value === e ? 'var(--accent)' : 'none', border: 'none', borderRadius: 6, padding: 4, cursor: 'pointer' }}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReassignModal({ oldCat, cats, spreadsheetId, onConfirm, onCancel }) {
  const [target, setTarget] = useState(cats[0]?.name || '')
  const [working, setWorking] = useState(false)

  const handleConfirm = async () => {
    setWorking(true)
    try {
      await reassignCategory(spreadsheetId, oldCat, target)
      onConfirm(oldCat, target)
    } catch { alert('Error al reasignar') }
    finally { setWorking(false) }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ padding: 24 }}>
        <div className="modal-handle" />
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Categoría en uso</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Hay transacciones con la categoría <strong>{oldCat}</strong>. ¿A qué categoría moverlas?
        </p>
        <div className="form-group">
          <select value={target} onChange={e => setTarget(e.target.value)}>
            {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirm} disabled={working}>
            {working ? 'Moviendo…' : 'Mover y eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Categories({ categories, onSave, transactions, spreadsheetId, onReassigned }) {
  const [cats, setCats] = useState({ gasto: [...categories.gasto], ingreso: [...categories.ingreso] })
  const [tab, setTab] = useState('gasto')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')
  const [editIdx, setEditIdx] = useState(null)
  const [editIcon, setEditIcon] = useState('')
  const [saved, setSaved] = useState(false)
  const [reassigning, setReassigning] = useState(null) // { cat, tipo }

  const add = () => {
    const val = newName.trim()
    if (!val || cats[tab].some(c => c.name === val)) return
    setCats(c => ({ ...c, [tab]: [...c[tab], { name: val, icon: newIcon }] }))
    setNewName(''); setNewIcon('📦'); setSaved(false)
  }

  const startEdit = (i) => { setEditIdx(i); setEditIcon(cats[tab][i].icon) }

  const saveEdit = (i) => {
    setCats(c => {
      const arr = [...c[tab]]
      arr[i] = { ...arr[i], icon: editIcon }
      return { ...c, [tab]: arr }
    })
    setEditIdx(null); setSaved(false)
  }

  const requestRemove = (i) => {
    const cat = cats[tab][i]
    const inUse = transactions.some(t => t.categoria === cat.name)
    if (inUse) {
      const others = cats[tab].filter((_, j) => j !== i)
      setReassigning({ cat: cat.name, tipo: tab, idx: i, others })
    } else {
      remove(i)
    }
  }

  const remove = (i) => {
    setCats(c => ({ ...c, [tab]: c[tab].filter((_, j) => j !== i) }))
    setSaved(false)
  }

  const handleReassignConfirm = (oldCat, newCat) => {
    onReassigned(oldCat, newCat)
    remove(reassigning.idx)
    setReassigning(null)
  }

  const handleSave = () => { onSave(cats); setSaved(true) }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Categorías</h2>

      <div className="tipo-toggle" style={{ marginBottom: 16 }}>
        <button type="button" className={`tipo-btn ${tab === 'gasto' ? 'active gasto' : ''}`} onClick={() => { setTab('gasto'); setEditIdx(null) }}>🔴 Gastos</button>
        <button type="button" className={`tipo-btn ${tab === 'ingreso' ? 'active ingreso' : ''}`} onClick={() => { setTab('ingreso'); setEditIdx(null) }}>🟢 Ingresos</button>
      </div>

      {/* Añadir nueva */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <EmojiPicker value={newIcon} onChange={setNewIcon} />
        <input
          placeholder="Nueva categoría…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 8, padding: '10px 12px', fontSize: 15 }}
        />
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={add}>+</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {cats[tab].length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>Sin categorías</p>}
        {cats[tab].map((cat, i) => (
          <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {editIdx === i ? (
              <>
                <EmojiPicker value={editIcon} onChange={setEditIcon} />
                <span style={{ flex: 1, fontSize: 14 }}>{cat.name}</span>
                <button onClick={() => saveEdit(i)} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', padding: 4 }}><Check size={16} /></button>
                <button onClick={() => setEditIdx(null)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <span style={{ flex: 1, fontSize: 14 }}>{cat.name}</span>
                <button onClick={() => startEdit(i)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}><Pencil size={14} /></button>
                <button onClick={() => requestRemove(i)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      {reassigning && (
        <ReassignModal
          oldCat={reassigning.cat}
          cats={reassigning.others}
          spreadsheetId={spreadsheetId}
          onConfirm={handleReassignConfirm}
          onCancel={() => setReassigning(null)}
        />
      )}
    </div>
  )
}
