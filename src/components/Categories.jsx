import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { reassignCategory } from '../services/googleSheets'
import BottomSheet from './BottomSheet'

function ReassignModal({ oldCat, cats, spreadsheetId, onConfirm, onCancel }) {
  const [target, setTarget] = useState(cats[0]?.name || '')
  const [working, setWorking] = useState(false)

  const handleConfirm = async () => {
    setWorking(true)
    try {
      await reassignCategory(spreadsheetId, oldCat, target)
      onConfirm(oldCat, target)
    } catch { alert('Error en reassignar') }
    finally { setWorking(false) }
  }

  return createPortal(
    <BottomSheet onClose={onCancel}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Categoria en ús</h3>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        Hi ha transaccions amb la categoria <strong>{oldCat}</strong>. A quina categoria les movem?
      </p>
      <div className="form-group">
        <select value={target} onChange={e => setTarget(e.target.value)}>
          {cats.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel·lar</button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={handleConfirm} disabled={working}>
          {working ? 'Movent…' : 'Moure i eliminar'}
        </button>
      </div>
    </BottomSheet>,
    document.body
  )
}

export default function Categories({ categories, onSave, transactions, spreadsheetId, onReassigned }) {
  const [cats, setCats] = useState({ gasto: [...categories.gasto], ingreso: [...categories.ingreso] })
  const [tab, setTab] = useState('gasto')
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📦')
  const [editIdx, setEditIdx] = useState(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [reassigning, setReassigning] = useState(null)
  const [renaming, setRenaming] = useState(false)

  const saveCats = (updated) => { setCats(updated); onSave(updated) }

  const add = () => {
    const val = newName.trim()
    if (!val || cats[tab].some(c => c.name === val)) return
    const updated = { ...cats, [tab]: [...cats[tab], { name: val, icon: newIcon }] }
    saveCats(updated)
    setNewName(''); setNewIcon('📦')
  }

  const startEdit = (i) => {
    setEditIdx(i)
    setEditIcon(cats[tab][i].icon)
    setEditName(cats[tab][i].name)
  }

  const saveEdit = async (i) => {
    const oldName = cats[tab][i].name
    const newName2 = editName.trim() || oldName
    const nameChanged = newName2 !== oldName
    const inUse = nameChanged && transactions.some(t => t.categoria === oldName)

    if (inUse) {
      setRenaming(true)
      try {
        await reassignCategory(spreadsheetId, oldName, newName2)
        onReassigned(oldName, newName2)
      } catch { alert('Error en actualitzar les entrades'); setRenaming(false); return }
      setRenaming(false)
    }

    const arr = [...cats[tab]]
    arr[i] = { name: newName2, icon: editIcon }
    saveCats({ ...cats, [tab]: arr })
    setEditIdx(null)
  }

  const requestRemove = (i) => {
    const cat = cats[tab][i]
    const inUse = transactions.some(t => t.categoria === cat.name)
    if (inUse) {
      const others = cats[tab].filter((_, j) => j !== i)
      if (others.length === 0) { alert("No pots eliminar l'única categoria"); return }
      setReassigning({ cat: cat.name, tipo: tab, idx: i, others })
    } else {
      remove(i)
    }
  }

  const remove = (i) => { saveCats({ ...cats, [tab]: cats[tab].filter((_, j) => j !== i) }) }

  const handleReassignConfirm = (oldCat, newCat) => {
    onReassigned(oldCat, newCat)
    remove(reassigning.idx)
    setReassigning(null)
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Categories</h2>

      <div className="tipo-toggle" style={{ marginBottom: 16 }}>
        <button type="button" className={`tipo-btn ${tab === 'gasto' ? 'active gasto' : ''}`} onClick={() => { setTab('gasto'); setEditIdx(null) }}>🔴 Despeses</button>
        <button type="button" className={`tipo-btn ${tab === 'ingreso' ? 'active ingreso' : ''}`} onClick={() => { setTab('ingreso'); setEditIdx(null) }}>🟢 Ingressos</button>
      </div>

      {/* Afegir nova */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={newIcon}
          onChange={e => setNewIcon(e.target.value)}
          style={{ width: 48, textAlign: 'center', fontSize: 22, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 8, padding: '8px 4px' }}
          maxLength={2}
        />
        <input
          placeholder="Nova categoria…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 8, padding: '10px 12px', fontSize: 15 }}
        />
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={add}>+</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 14, marginTop: -10 }}>
        Posa el cursor al camp de l'emoji i obre el teclat d'emojis (🌐 o Ctrl+Cmd+Espai al Mac)
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        {cats[tab].length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>Sense categories</p>}
        {[...cats[tab]].map((cat, _, arr) => ({ cat, origIdx: cats[tab].indexOf(cat) }))
          .sort((a, b) => a.cat.name.localeCompare(b.cat.name, 'ca'))
          .map(({ cat, origIdx }, displayIdx, sortedArr) => {
          const i = origIdx
          return (
          <div key={cat.name + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: displayIdx < sortedArr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {editIdx === i ? (
              <>
                <input
                  value={editIcon}
                  onChange={e => setEditIcon(e.target.value)}
                  style={{ width: 44, textAlign: 'center', fontSize: 20, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 6, padding: '4px' }}
                  maxLength={2}
                />
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(i)}
                  style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 6, padding: '6px 10px', fontSize: 14 }}
                />
                <button onClick={() => saveEdit(i)} disabled={renaming} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', padding: 4 }}>
                  {renaming ? '…' : <Check size={16} />}
                </button>
                <button onClick={() => setEditIdx(null)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4 }}>
                  <X size={16} />
                </button>
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
        )})}
      </div>

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
