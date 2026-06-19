import { useState } from 'react'
import { addTransaction } from '../services/googleSheets'

const CATEGORIAS_GASTO = ['Alimentación', 'Transporte', 'Ocio', 'Salud', 'Ropa', 'Casa', 'Suscripciones', 'Restaurantes', 'Viajes', 'Otros']
const CATEGORIAS_INGRESO = ['Nómina', 'Trabajo', 'Inversiones', 'Regalo', 'Otros']

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function AddTransaction({ spreadsheetId, onAdded }) {
  const [tipo, setTipo] = useState('gasto')
  const [form, setForm] = useState({ fecha: today(), importe: '', categoria: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const cats = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.importe || !form.categoria) { setError('Rellena importe y categoría'); return }
    setSaving(true); setError('')
    try {
      const tx = await addTransaction(spreadsheetId, { ...form, tipo, importe: parseFloat(form.importe) })
      onAdded(tx)
      setForm({ fecha: today(), importe: '', categoria: '', descripcion: '' })
    } catch (err) {
      setError('Error al guardar. Comprueba la conexión.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Nueva transacción</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Tipo</label>
          <div className="tipo-toggle">
            <button type="button" className={`tipo-btn ${tipo === 'gasto' ? 'active gasto' : ''}`} onClick={() => { setTipo('gasto'); setForm(f => ({ ...f, categoria: '' })) }}>
              🔴 Gasto
            </button>
            <button type="button" className={`tipo-btn ${tipo === 'ingreso' ? 'active ingreso' : ''}`} onClick={() => { setTipo('ingreso'); setForm(f => ({ ...f, categoria: '' })) }}>
              🟢 Ingreso
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Importe (€)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={form.importe} onChange={set('importe')} inputMode="decimal" />
        </div>

        <div className="form-group">
          <label>Categoría</label>
          <select value={form.categoria} onChange={set('categoria')}>
            <option value="">Selecciona…</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Fecha</label>
          <input type="date" value={form.fecha} onChange={set('fecha')} />
        </div>

        <div className="form-group">
          <label>Descripción (opcional)</label>
          <textarea placeholder="Ej: Supermercado Mercadona…" value={form.descripcion} onChange={set('descripcion')} />
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : `Guardar ${tipo}`}
        </button>
      </form>
    </div>
  )
}
