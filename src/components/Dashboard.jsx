const CAT_ICONS = {
  'Alimentación': '🛒', 'Transporte': '🚗', 'Ocio': '🎬', 'Salud': '💊',
  'Ropa': '👕', 'Casa': '🏠', 'Suscripciones': '📱', 'Restaurantes': '🍽️',
  'Viajes': '✈️', 'Trabajo': '💼', 'Otros': '📦', 'Nómina': '💵',
}
const icon = (cat) => CAT_ICONS[cat] || '💰'

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function Dashboard({ transactions, loading, onRefresh }) {
  const ingresos = transactions.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.importe, 0)
  const gastos = transactions.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.importe, 0)
  const balance = ingresos - gastos

  const recent = transactions.slice(0, 8)

  return (
    <div>
      <div className="card balance-card">
        <div className="balance-label">Balance actual</div>
        <div className={`balance-amount ${balance >= 0 ? 'positive' : 'negative'}`}>
          {fmt(balance)}
        </div>
        <div className="balance-row">
          <div className="balance-mini">
            <div className="label">Ingresos</div>
            <div className="value ing">{fmt(ingresos)}</div>
          </div>
          <div className="balance-mini">
            <div className="label">Gastos</div>
            <div className="value gas">{fmt(gastos)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-header">
          <span className="section-title">Recientes</span>
          <button className="btn-ghost small" onClick={onRefresh} disabled={loading}>
            {loading ? '…' : '↻ Actualizar'}
          </button>
        </div>

        {loading && <p className="empty">Cargando…</p>}
        {!loading && recent.length === 0 && <p className="empty">Sin transacciones aún.<br />Pulsa ➕ para añadir la primera.</p>}

        <div className="recent-list">
          {recent.map((tx) => (
            <div key={tx.id} className="tx-item">
              <span className="tx-icon">{icon(tx.categoria)}</span>
              <div className="tx-info">
                <div className="tx-cat">{tx.categoria}</div>
                {tx.descripcion && <div className="tx-desc">{tx.descripcion}</div>}
                <div className="tx-date">{tx.fecha}</div>
              </div>
              <span className={`tx-amount ${tx.tipo}`}>
                {tx.tipo === 'gasto' ? '-' : '+'}{fmt(tx.importe)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
