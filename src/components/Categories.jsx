import { useState } from 'react'

export default function Categories({ categories, onSave }) {
  const [cats, setCats] = useState({ gasto: [...categories.gasto], ingreso: [...categories.ingreso] })
  const [tab, setTab] = useState('gasto')
  const [input, setInput] = useState('')
  const [saved, setSaved] = useState(false)

  const add = () => {
    const val = input.trim()
    if (!val || cats[tab].includes(val)) return
    setCats(c => ({ ...c, [tab]: [...c[tab], val] }))
    setInput('')
    setSaved(false)
  }

  const remove = (tipo, cat) => {
    setCats(c => ({ ...c, [tipo]: c[tipo].filter(x => x !== cat) }))
    setSaved(false)
  }

  const handleSave = () => {
    onSave(cats)
    setSaved(true)
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Categorías</h2>

      <div className="tipo-toggle" style={{ marginBottom: 16 }}>
        <button type="button" className={`tipo-btn ${tab === 'gasto' ? 'active gasto' : ''}`} onClick={() => setTab('gasto')}>🔴 Gastos</button>
        <button type="button" className={`tipo-btn ${tab === 'ingreso' ? 'active ingreso' : ''}`} onClick={() => setTab('ingreso')}>🟢 Ingresos</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Nueva categoría…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text1)', borderRadius: 8, padding: '10px 12px', fontSize: 15 }}
        />
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={add}>+</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {cats[tab].length === 0 && <p style={{ color: 'var(--text2)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Sin categorías</p>}
        {cats[tab].map(cat => (
          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 14 }}>{cat}</span>
            <button onClick={() => remove(tab, cat)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 18, padding: '0 4px', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>
    </div>
  )
}
