import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { addTransaction } from '../services/googleSheets'
import { parseImport } from '../utils/dates'

function today() {
  return new Date().toISOString().split('T')[0]
}

function getSuggestions(transactions, tipo, categoria, query) {
  if (!categoria || !transactions?.length) return []
  const seen = new Set()
  const results = []
  for (const tx of transactions) {
    if (tx.tipo !== tipo || tx.categoria !== categoria) continue
    const desc = tx.descripcion?.trim()
    if (!desc) continue
    const lq = query.toLowerCase()
    if (lq && !desc.toLowerCase().includes(lq)) continue
    if (!seen.has(desc)) {
      seen.add(desc)
      results.push(desc)
    }
    if (results.length >= 5) break
  }
  return results
}

export default function AddTransaction({ spreadsheetId, onAdded, categories, onCancel, transactions, readOnly, inline }) {
  const [tipo, setTipo] = useState('gasto')
  const [form, setForm] = useState({ fecha: today(), importe: '', categoria: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const descRef = useRef(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const cats = tipo === 'gasto' ? (categories?.gasto || []) : (categories?.ingreso || [])

  const suggestions = getSuggestions(transactions, tipo, form.categoria, form.descripcion)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.importe || !form.categoria) { setError('Omple import i categoria'); return }
    if (readOnly) return
    setSaving(true); setError('')
    try {
      const tx = await addTransaction(spreadsheetId, { ...form, tipo, importe: parseImport(form.importe) })
      onAdded(tx)
      setForm({ fecha: today(), importe: '', categoria: '', descripcion: '' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError('Error en guardar. Comprova la connexió.')
      console.error(err)
    } finally { setSaving(false) }
  }

  const applySuggestion = (desc) => {
    setForm(f => ({ ...f, descripcion: desc }))
    setShowSuggestions(false)
    descRef.current?.blur()
  }

  return (
    <div>
      {!inline && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Nova transacció</h2>
          {onCancel && <button className="btn-icon" onClick={onCancel}><X size={20} /></button>}
        </div>
      )}

      {inline && (
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18 }}>Nova transacció</h2>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tipus</label>
          <div className="tipo-toggle">
            <button type="button" className={`tipo-btn ${tipo === 'gasto' ? 'active gasto' : ''}`}
              onClick={() => { setTipo('gasto'); setForm(f => ({ ...f, categoria: '' })) }}>
              🔴 Despesa
            </button>
            <button type="button" className={`tipo-btn ${tipo === 'ingreso' ? 'active ingreso' : ''}`}
              onClick={() => { setTipo('ingreso'); setForm(f => ({ ...f, categoria: '' })) }}>
              🟢 Ingrés
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Import (€)</label>
          <input type="number" min="0" step="0.01" placeholder="0,00" value={form.importe} onChange={set('importe')} inputMode="decimal" />
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

        <div className="form-group" style={{ position: 'relative' }}>
          <label>Descripció (opcional)</label>
          <textarea
            ref={descRef}
            placeholder="Ex: Supermercat Mercadona…"
            value={form.descripcion}
            onChange={set('descripcion')}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map(s => (
                <button key={s} type="button" className="suggestion-item" onMouseDown={() => applySuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button className="btn-primary" type="submit" disabled={saving || readOnly}>
          {saving ? 'Desant…' : saved ? '✓ Desat!' : `Desar ${tipo === 'gasto' ? 'despesa' : 'ingrés'}`}
        </button>
      </form>
    </div>
  )
}
