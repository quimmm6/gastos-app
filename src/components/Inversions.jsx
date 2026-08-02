import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronLeft, Trash2, X, Edit2, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  getFunds, addFund, updateFund, deleteFund,
  getInvEntries, addInvEntry, updateInvEntry, deleteInvEntry,
  getRecFunds, addRecFund, updateRecFund, deleteRecFund, applyRecurringContributions,
} from '../services/googleSheets'

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() }

function fmt(n) { return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) }
function fmt2(n) { return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) }
function fmtPct(n) { return `${n > 0 ? '+' : ''}${n.toFixed(2)}%` }
function pctColor(n) { return n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--text2)' }
function ym2label(ym) { if (!ym) return ''; const [y, m] = ym.split('-'); return `${m}/${y?.slice(2)}` }
function todayStr() { return new Date().toISOString().split('T')[0] }
function currentYM() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` }

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc', '#fb923c', '#a3e635']

// ── DiaInput (reused pattern from TransactionList) ─────────────────────────
function DiaInput({ value, onChange }) {
  const isP = value === 'P', isU = value === 'U', isSpecial = isP || isU
  const numVal = isSpecial ? (isU ? '31' : '1') : value
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={numVal} disabled={isSpecial} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: isSpecial ? 'var(--text2)' : 'var(--text1)', borderRadius: 8, padding: '10px 12px', fontSize: 15, opacity: isSpecial ? 0.45 : 1, WebkitAppearance: 'none', appearance: 'none' }}>
          {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(d => <option key={d} value={d}>Dia {d}</option>)}
        </select>
        {[['P', 'Primer'], ['U', 'Últim']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(value === v ? (v === 'P' ? '1' : '28') : v)}
            style={{ padding: '10px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', background: value === v ? 'var(--accent)' : 'var(--bg3)', border: `1px solid ${value === v ? 'var(--accent)' : 'var(--border)'}`, color: value === v ? '#fff' : 'var(--text2)' }}>
            {l}
          </button>
        ))}
      </div>
      {isU && <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>S'adaptarà a l'últim dia de cada mes.</p>}
    </div>
  )
}

// ── Metrics ───────────────────────────────────────────────────────────────
function calcFundMetrics(fund, allEntries) {
  const es = allEntries.filter(e => e.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  if (!es.length) return null
  const now = new Date()
  const curYear = String(now.getFullYear())
  const curYM = currentYM()
  const totalInvested = es.reduce((s, e) => s + e.amountAdded, 0)
  const currentValue = es[es.length - 1].currentValue
  const gain = currentValue - totalInvested
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0
  const prevYearEs = es.filter(e => e.date.slice(0, 4) < curYear)
  const prevYearVal = prevYearEs.length ? prevYearEs[prevYearEs.length - 1].currentValue : 0
  const thisYearAdded = es.filter(e => e.date.slice(0, 4) === curYear).reduce((s, e) => s + e.amountAdded, 0)
  const ytdBase = prevYearVal + thisYearAdded
  const ytdGain = ytdBase > 0 ? currentValue - ytdBase : 0
  const ytdPct = ytdBase > 0 ? (ytdGain / ytdBase) * 100 : null
  const prevMonthEs = es.filter(e => e.date.slice(0, 7) < curYM)
  const prevMonthVal = prevMonthEs.length ? prevMonthEs[prevMonthEs.length - 1].currentValue : 0
  const thisMonthAdded = es.filter(e => e.date.slice(0, 7) === curYM).reduce((s, e) => s + e.amountAdded, 0)
  const monthBase = prevMonthVal + thisMonthAdded
  const monthGain = monthBase > 0 ? currentValue - monthBase : 0
  const monthPct = monthBase > 0 ? (monthGain / monthBase) * 100 : null
  return { totalInvested, currentValue, gain, gainPct, ytdGain, ytdPct, monthGain, monthPct, sortedEntries: es }
}

function calcPortfolioMetrics(funds, allEntries) {
  const mets = funds.map(f => calcFundMetrics(f, allEntries)).filter(Boolean)
  if (!mets.length) return null
  const totalInvested = mets.reduce((s, m) => s + m.totalInvested, 0)
  const currentValue = mets.reduce((s, m) => s + m.currentValue, 0)
  const gain = currentValue - totalInvested
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0
  const ytdGain = mets.reduce((s, m) => s + (m.ytdGain || 0), 0)
  const ytdPcts = mets.filter(m => m.ytdPct !== null)
  const ytdPct = ytdPcts.length ? ytdPcts.reduce((s, m) => s + m.ytdPct, 0) / ytdPcts.length : null
  const monthGain = mets.reduce((s, m) => s + (m.monthGain || 0), 0)
  const monthPcts = mets.filter(m => m.monthPct !== null)
  const monthPct = monthPcts.length ? monthPcts.reduce((s, m) => s + m.monthPct, 0) / monthPcts.length : null
  return { totalInvested, currentValue, gain, gainPct, ytdGain, ytdPct, monthGain, monthPct }
}

function buildChartData(funds, allEntries) {
  if (!funds.length || !allEntries.length) return []
  const allYMs = [...new Set(allEntries.map(e => e.date.slice(0, 7)))].sort()
  return allYMs.map(ym => {
    const point = { mes: ym2label(ym) }
    let total = 0, hasAny = false
    funds.forEach(f => {
      const es = allEntries.filter(e => e.fundId === f.id && e.date.slice(0, 7) <= ym).sort((a, b) => a.date.localeCompare(b.date))
      const val = es.length ? es[es.length - 1].currentValue : null
      if (val !== null) { point[f.id] = val; total += val; hasAny = true }
    })
    if (hasAny) point._total = total
    return point
  })
}

// ── Sheet modal ───────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Metric cards ──────────────────────────────────────────────────────────
function MetricRow({ metrics }) {
  if (!metrics) return null
  const { currentValue, totalInvested, gain, gainPct, ytdGain, ytdPct, monthGain, monthPct } = metrics
  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Valor actual</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt2(currentValue)}</div>
        </div>
        <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Total invertit</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(totalInvested)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Guany total</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(gain) }}>{fmt2(gain)}</div>
          <div style={{ fontSize: 12, color: pctColor(gainPct) }}>{fmtPct(gainPct)}</div>
        </div>
        {ytdPct !== null && (
          <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>YTD</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(ytdGain) }}>{fmt2(ytdGain)}</div>
            <div style={{ fontSize: 12, color: pctColor(ytdPct) }}>{fmtPct(ytdPct)}</div>
          </div>
        )}
        {monthPct !== null && (
          <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Aquest mes</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(monthGain) }}>{fmt2(monthGain)}</div>
            <div style={{ fontSize: 12, color: pctColor(monthPct) }}>{fmtPct(monthPct)}</div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Forms ─────────────────────────────────────────────────────────────────
function FundForm({ initial, onClose, onSave, saving }) {
  const [name, setName] = useState(initial?.name || '')
  const [isin, setIsin] = useState(initial?.isin || '')
  return (
    <Sheet title={initial ? 'Editar fons' : 'Nou fons'} onClose={onClose}>
      <div className="form-group">
        <label>Nom del fons</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vanguard Global Stock" />
      </div>
      <div className="form-group">
        <label>ISIN (opcional)</label>
        <input value={isin} onChange={e => setIsin(e.target.value.toUpperCase())} placeholder="IE00B3XXRP09" maxLength={12} style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
      </div>
      <button className="btn-primary" disabled={!name.trim() || saving} onClick={() => name.trim() && onSave({ name: name.trim(), isin: isin.trim() })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Crear fons'}
      </button>
    </Sheet>
  )
}

function EntryForm({ funds, initialFundId, initial, onClose, onSave, saving }) {
  const [fundId, setFundId] = useState(initial?.fundId || initialFundId || funds[0]?.id || '')
  const [date, setDate] = useState(initial?.date || todayStr())
  const [amountAdded, setAmountAdded] = useState(initial ? String(initial.amountAdded) : '')
  const [currentValue, setCurrentValue] = useState(initial ? String(initial.currentValue) : '')
  const valid = fundId && date && currentValue !== ''
  return (
    <Sheet title={initial ? 'Editar entrada' : 'Nova entrada'} onClose={onClose}>
      {!initial && (
        <div className="form-group">
          <label>Fons</label>
          <select value={fundId} onChange={e => setFundId(e.target.value)}>
            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      <div className="form-group">
        <label>Data</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Aportació (€) <span style={{ color: 'var(--text2)', fontSize: 11 }}>— 0 si no n'hi ha</span></label>
        <input type="number" min="0" step="0.01" placeholder="0" value={amountAdded} onChange={e => setAmountAdded(e.target.value)} inputMode="decimal" />
      </div>
      <div className="form-group">
        <label>Valor actual del fons (€)</label>
        <input type="number" min="0" step="0.01" placeholder="Valor total avui" value={currentValue} onChange={e => setCurrentValue(e.target.value)} inputMode="decimal" />
      </div>
      <button className="btn-primary" disabled={!valid || saving}
        onClick={() => valid && onSave({ fundId, date, amountAdded: parseFloat(amountAdded || 0), currentValue: parseFloat(currentValue) })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Desar entrada'}
      </button>
    </Sheet>
  )
}

function RecForm({ fund, initial, onClose, onSave, saving }) {
  const [dia, setDia] = useState(initial?.dia || '1')
  const [inici, setInici] = useState(initial?.inici || currentYM())
  const [importe, setImporte] = useState(initial ? String(initial.importe) : '')
  const valid = dia && inici && importe
  return (
    <Sheet title={initial ? 'Editar recurrent' : 'Aportació recurrent'} onClose={onClose}>
      {!initial && (
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          Fons: <strong style={{ color: 'var(--text1)' }}>{fund.name}</strong><br />
          S'aplicarà automàticament cada mes. Actualitza el valor manualment quan vulguis.
        </p>
      )}
      <div className="form-group">
        <label>Dia del mes</label>
        <DiaInput value={dia} onChange={setDia} />
      </div>
      <div className="form-group">
        <label>Mes d'inici</label>
        <input type="month" value={inici} onChange={e => setInici(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Import mensual (€)</label>
        <input type="number" min="0" step="0.01" placeholder="Ex: 200" value={importe} onChange={e => setImporte(e.target.value)} inputMode="decimal" />
      </div>
      <button className="btn-primary" disabled={!valid || saving}
        onClick={() => valid && onSave({ fundId: fund.id, dia, inici, importe: parseFloat(importe) })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Crear aportació recurrent'}
      </button>
    </Sheet>
  )
}

// ── Fund Detail ───────────────────────────────────────────────────────────
function FundDetail({ fund, entries, recFunds, colorIdx, onBack, onAddEntry, onEditEntry, onDeleteEntry, onEditFund, onDeleteFund, onAddRec, onEditRec, onToggleRec, onDeleteRec }) {
  const metrics = calcFundMetrics(fund, entries)
  const chartData = buildChartData([fund], entries)
  const color = COLORS[colorIdx % COLORS.length]
  const myRecs = recFunds.filter(r => r.fundId === fund.id)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn-icon" onClick={onBack}><ChevronLeft size={22} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{fund.name}</div>
          {fund.isin && <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace', letterSpacing: 0.5, marginTop: 1 }}>{fund.isin}</div>}
        </div>
        <button className="btn-icon" onClick={onEditFund}><Edit2 size={17} /></button>
        <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={onDeleteFund}><Trash2 size={17} /></button>
      </div>

      <MetricRow metrics={metrics} />
      {!metrics && <p className="empty" style={{ marginBottom: 20 }}>Sense entrades. Afegeix-ne una!</p>}

      {chartData.length > 1 && (
        <div className="stats-section">
          <div className="stats-title">Evolució</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }} formatter={v => [fmt2(v)]} />
                <Line type="monotone" dataKey={fund.id} stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} name={fund.name} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recurring contributions */}
      <div className="stats-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="stats-title" style={{ margin: 0 }}>Aportacions recurrents</div>
          <button className="btn-icon" style={{ color: 'var(--accent)' }} onClick={onAddRec}><Plus size={19} /></button>
        </div>
        {myRecs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>Cap aportació recurrent configurada.</p>}
        {myRecs.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 8, opacity: r.activa ? 1 : 0.5 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(r.importe)}/mes {!r.activa && <span style={{ fontSize: 11, color: 'var(--text2)' }}>(inactiva)</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>Dia {r.dia === 'U' ? 'últim' : r.dia} · des de {r.inici}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="btn-icon" onClick={() => onToggleRec(r)}
                style={{ fontSize: 11, color: r.activa ? 'var(--green)' : 'var(--text2)', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
                {r.activa ? 'Activa' : 'Inactiva'}
              </button>
              <button className="btn-icon" onClick={() => onEditRec(r)}><Edit2 size={14} /></button>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => onDeleteRec(r.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Entry history */}
      <div className="stats-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="stats-title" style={{ margin: 0 }}>Historial d'entrades</div>
          <button className="btn-icon" style={{ color: 'var(--accent)' }} onClick={onAddEntry}><Plus size={19} /></button>
        </div>
        {!metrics?.sortedEntries.length && (
          <button className="btn-primary" onClick={onAddEntry} style={{ marginTop: 8 }}>
            <Plus size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />Afegir primera entrada
          </button>
        )}
        {metrics?.sortedEntries.slice().reverse().map(e => (
          <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>{e.date}</div>
              {e.amountAdded > 0
                ? <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>+{fmt2(e.amountAdded)}</div>
                : <div style={{ fontSize: 12, color: 'var(--text2)' }}>Sense aportació</div>
              }
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt2(e.currentValue)}</div>
              <button className="btn-icon" onClick={() => onEditEntry(e)}><Edit2 size={14} /></button>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => onDeleteEntry(e.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Portfolio view ────────────────────────────────────────────────────────
function PortfolioView({ funds, entries, loading, onSelectFund, onAddFund, onAddEntry, onRefresh }) {
  const portfolio = calcPortfolioMetrics(funds, entries)
  const chartData = useMemo(() => buildChartData(funds, entries), [funds, entries])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn-icon" onClick={onRefresh}><RefreshCw size={16} /></button>
      </div>

      <MetricRow metrics={portfolio} />

      {chartData.length > 1 && (
        <div className="stats-section">
          <div className="stats-title">Evolució cartera</div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }}
                  formatter={(v, name) => [fmt2(v), name]} />
                {funds.length > 1 && <Line type="monotone" dataKey="_total" stroke={cssVar('--text2')} strokeWidth={2} strokeDasharray="5 3" dot={false} name="Total" connectNulls />}
                {funds.map((f, i) => (
                  <Line key={f.id} type="monotone" dataKey={f.id} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }} name={f.name} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6, flexWrap: 'wrap' }}>
            {funds.length > 1 && <span>— Total</span>}
            {funds.map((f, i) => <span key={f.id}><span style={{ color: COLORS[i % COLORS.length] }}>■</span> {f.name}</span>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stats-title" style={{ margin: 0 }}>Els meus fons</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {funds.length > 0 && (
            <button className="btn-ghost small" onClick={onAddEntry} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> Entrada
            </button>
          )}
          <button className="btn-ghost small" onClick={onAddFund} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={13} /> Fons
          </button>
        </div>
      </div>

      {loading && !funds.length && <p className="empty">Carregant…</p>}
      {!loading && !funds.length && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📈</div>
          <div style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 14 }}>Afegeix el teu primer fons d'inversió</div>
          <button className="btn-primary" onClick={onAddFund}><Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Afegir fons</button>
        </div>
      )}

      {funds.map((f, i) => {
        const m = calcFundMetrics(f, entries)
        return (
          <div key={f.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onSelectFund(f.id, i)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</div>
                  {f.isin && <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace' }}>{f.isin}</div>}
                </div>
              </div>
              {m ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt2(m.currentValue)}</div>
                  <div style={{ fontSize: 12, color: pctColor(m.gainPct) }}>{fmtPct(m.gainPct)}</div>
                </div>
              ) : <span style={{ fontSize: 12, color: 'var(--text2)' }}>Sense dades</span>}
            </div>
            {m && (
              <div style={{ display: 'flex', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                <span>Invertit <strong style={{ color: 'var(--text1)' }}>{fmt(m.totalInvested)}</strong></span>
                <span>Guany <strong style={{ color: pctColor(m.gain) }}>{fmt2(m.gain)}</strong></span>
                {m.ytdPct !== null && <span>YTD <strong style={{ color: pctColor(m.ytdPct) }}>{fmtPct(m.ytdPct)}</strong></span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function Inversions({ spreadsheetId }) {
  const [funds, setFunds] = useState([])
  const [entries, setEntries] = useState([])
  const [recFunds, setRecFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFundId, setSelectedFundId] = useState(null)
  const [selectedFundIdx, setSelectedFundIdx] = useState(0)
  const [modal, setModal] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const selectedFund = funds.find(f => f.id === selectedFundId) || null

  const fetchData = async () => {
    setLoading(true)
    try {
      const [f, e, r, newEntries] = await Promise.all([
        getFunds(spreadsheetId), getInvEntries(spreadsheetId),
        getRecFunds(spreadsheetId), applyRecurringContributions(spreadsheetId),
      ])
      setFunds(f); setRecFunds(r)
      const allEntries = [...e]
      newEntries.forEach(ne => { if (!allEntries.find(x => x.id === ne.id)) allEntries.push(ne) })
      setEntries(allEntries)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (spreadsheetId) fetchData() }, [spreadsheetId])

  const close = () => { setModal(null); setEditTarget(null) }

  const handleAddFund = async ({ name, isin }) => {
    setSaving(true)
    try { const f = await addFund(spreadsheetId, { name, isin }); setFunds(p => [...p, f]); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditFund = async ({ name, isin }) => {
    setSaving(true)
    try {
      const u = { ...selectedFund, name, isin }
      await updateFund(spreadsheetId, u)
      setFunds(p => p.map(f => f.id === u.id ? u : f)); close()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleDeleteFund = async (id) => {
    if (!window.confirm('Eliminar el fons i totes les seves entrades i recurrents?')) return
    try {
      await deleteFund(spreadsheetId, id)
      const toDelete = entries.filter(e => e.fundId === id)
      const toDeleteRec = recFunds.filter(r => r.fundId === id)
      await Promise.all([...toDelete.map(e => deleteInvEntry(spreadsheetId, e.id)), ...toDeleteRec.map(r => deleteRecFund(spreadsheetId, r.id))])
      setFunds(p => p.filter(f => f.id !== id))
      setEntries(p => p.filter(e => e.fundId !== id))
      setRecFunds(p => p.filter(r => r.fundId !== id))
      setSelectedFundId(null)
    } catch (e) { console.error(e) }
  }
  const handleAddEntry = async ({ fundId, date, amountAdded, currentValue }) => {
    setSaving(true)
    try { const e = await addInvEntry(spreadsheetId, { fundId, date, amountAdded, currentValue }); setEntries(p => [...p, e]); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditEntry = async ({ date, amountAdded, currentValue }) => {
    setSaving(true)
    try {
      const u = { ...editTarget, date, amountAdded, currentValue }
      await updateInvEntry(spreadsheetId, u)
      setEntries(p => p.map(e => e.id === u.id ? u : e)); close()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleDeleteEntry = async (id) => {
    try { await deleteInvEntry(spreadsheetId, id); setEntries(p => p.filter(e => e.id !== id)) }
    catch (e) { console.error(e) }
  }
  const handleAddRec = async (rec) => {
    setSaving(true)
    try { const r = await addRecFund(spreadsheetId, { ...rec, activa: true }); setRecFunds(p => [...p, r]); close(); fetchData() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditRec = async (rec) => {
    setSaving(true)
    try {
      const u = { ...editTarget, ...rec }
      await updateRecFund(spreadsheetId, u)
      setRecFunds(p => p.map(r => r.id === u.id ? u : r)); close()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleToggleRec = async (rec) => {
    const u = { ...rec, activa: !rec.activa }
    try { await updateRecFund(spreadsheetId, u); setRecFunds(p => p.map(r => r.id === u.id ? u : r)) }
    catch (e) { console.error(e) }
  }
  const handleDeleteRec = async (id) => {
    try { await deleteRecFund(spreadsheetId, id); setRecFunds(p => p.filter(r => r.id !== id)) }
    catch (e) { console.error(e) }
  }

  const entryInitialFundId = selectedFund?.id || funds[0]?.id

  return (
    <div>
      {selectedFund ? (
        <FundDetail
          fund={selectedFund} entries={entries} recFunds={recFunds} colorIdx={selectedFundIdx}
          onBack={() => setSelectedFundId(null)}
          onAddEntry={() => setModal('addEntry')}
          onEditEntry={e => { setEditTarget(e); setModal('editEntry') }}
          onDeleteEntry={handleDeleteEntry}
          onEditFund={() => setModal('editFund')}
          onDeleteFund={() => handleDeleteFund(selectedFund.id)}
          onAddRec={() => setModal('addRec')}
          onEditRec={r => { setEditTarget(r); setModal('editRec') }}
          onToggleRec={handleToggleRec}
          onDeleteRec={handleDeleteRec}
        />
      ) : (
        <PortfolioView
          funds={funds} entries={entries} loading={loading}
          onSelectFund={(id, idx) => { setSelectedFundId(id); setSelectedFundIdx(idx) }}
          onAddFund={() => setModal('addFund')}
          onAddEntry={() => setModal('addEntry')}
          onRefresh={fetchData}
        />
      )}

      {modal === 'addFund' && <FundForm onClose={close} onSave={handleAddFund} saving={saving} />}
      {modal === 'editFund' && selectedFund && <FundForm initial={selectedFund} onClose={close} onSave={handleEditFund} saving={saving} />}
      {modal === 'addEntry' && funds.length > 0 && <EntryForm funds={funds} initialFundId={entryInitialFundId} onClose={close} onSave={handleAddEntry} saving={saving} />}
      {modal === 'editEntry' && editTarget && <EntryForm funds={funds} initial={editTarget} onClose={close} onSave={handleEditEntry} saving={saving} />}
      {modal === 'addRec' && selectedFund && <RecForm fund={selectedFund} onClose={close} onSave={handleAddRec} saving={saving} />}
      {modal === 'editRec' && editTarget && selectedFund && <RecForm fund={selectedFund} initial={editTarget} onClose={close} onSave={handleEditRec} saving={saving} />}
    </div>
  )
}
