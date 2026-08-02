import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronLeft, Trash2, X, Edit2, RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getFunds, addFund, updateFund, deleteFund, getInvEntries, addInvEntry, deleteInvEntry } from '../services/googleSheets'

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() }

// ── Formatting ────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) }
function fmt2(n) { return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) }
function fmtPct(n) { const s = n > 0 ? '+' : ''; return `${s}${n.toFixed(2)}%` }
function pctColor(n) { return n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--text2)' }
function ym2label(ym) { if (!ym) return ''; const [y, m] = ym.split('-'); return `${m}/${y?.slice(2)}` }
function todayStr() { return new Date().toISOString().split('T')[0] }

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#c084fc', '#fb923c', '#a3e635']

// ── Metrics ───────────────────────────────────────────────────────────────
function calcFundMetrics(fund, allEntries) {
  const es = allEntries.filter(e => e.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  if (!es.length) return null

  const now = new Date()
  const curYear = String(now.getFullYear())
  const curYM = `${curYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

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
    let total = 0
    funds.forEach(f => {
      const es = allEntries.filter(e => e.fundId === f.id && e.date.slice(0, 7) <= ym).sort((a, b) => a.date.localeCompare(b.date))
      const val = es.length ? es[es.length - 1].currentValue : null
      if (val !== null) { point[f.id] = val; total += val }
    })
    if (Object.keys(point).length > 1) point._total = total
    return point
  })
}

// ── UI helpers ────────────────────────────────────────────────────────────
function MCard({ label, value, sub, subColor }) {
  return (
    <div className="card" style={{ padding: '12px 14px', flex: '1 1 140px' }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)' }}>{value}</div>
      {sub !== undefined && sub !== null && (
        <div style={{ fontSize: 12, marginTop: 2, color: subColor || 'var(--text2)' }}>{sub}</div>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AddFundModal({ onClose, onSave, initial, saving }) {
  const [name, setName] = useState(initial?.name || '')
  const [isin, setIsin] = useState(initial?.isin || '')
  return (
    <Modal title={initial ? 'Editar fons' : 'Nou fons'} onClose={onClose}>
      <div className="form-group">
        <label>Nom del fons</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vanguard Global Stock" />
      </div>
      <div className="form-group">
        <label>ISIN (opcional)</label>
        <input value={isin} onChange={e => setIsin(e.target.value.toUpperCase())} placeholder="Ex: IE00B3XXRP09" maxLength={12} style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
      </div>
      <button className="btn-primary" disabled={!name.trim() || saving}
        onClick={() => name.trim() && onSave({ name: name.trim(), isin: isin.trim() })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Crear fons'}
      </button>
    </Modal>
  )
}

function AddEntryModal({ funds, initialFundId, onClose, onSave, saving }) {
  const [fundId, setFundId] = useState(initialFundId || (funds[0]?.id || ''))
  const [date, setDate] = useState(todayStr())
  const [amountAdded, setAmountAdded] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const valid = fundId && date && currentValue !== ''
  return (
    <Modal title="Afegir entrada" onClose={onClose}>
      <div className="form-group">
        <label>Fons</label>
        <select value={fundId} onChange={e => setFundId(e.target.value)}>
          {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Data</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Aportació aquest període (€)</label>
        <input type="number" min="0" step="0.01" placeholder="0 si no has aportat" value={amountAdded} onChange={e => setAmountAdded(e.target.value)} inputMode="decimal" />
      </div>
      <div className="form-group">
        <label>Valor actual del fons (€)</label>
        <input type="number" min="0" step="0.01" placeholder="Valor total avui" value={currentValue} onChange={e => setCurrentValue(e.target.value)} inputMode="decimal" />
      </div>
      <button className="btn-primary" disabled={!valid || saving}
        onClick={() => valid && onSave({ fundId, date, amountAdded: parseFloat(amountAdded || 0), currentValue: parseFloat(currentValue) })}>
        {saving ? 'Desant…' : 'Desar entrada'}
      </button>
    </Modal>
  )
}

// ── Fund detail ───────────────────────────────────────────────────────────
function FundDetail({ fund, entries, onBack, onAddEntry, onDeleteEntry, onEditFund, onDeleteFund, colorIdx }) {
  const metrics = calcFundMetrics(fund, entries)
  const chartData = buildChartData([fund], entries)
  const color = COLORS[colorIdx % COLORS.length]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn-icon" onClick={onBack}><ChevronLeft size={22} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{fund.name}</div>
          {fund.isin && <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace', letterSpacing: 0.5 }}>{fund.isin}</div>}
        </div>
        <button className="btn-icon" onClick={onEditFund}><Edit2 size={16} /></button>
        <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={onDeleteFund}><Trash2 size={16} /></button>
      </div>

      {metrics ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <MCard label="Valor actual" value={fmt2(metrics.currentValue)} />
            <MCard label="Total invertit" value={fmt(metrics.totalInvested)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <MCard label="Guany total" value={fmt2(metrics.gain)} sub={fmtPct(metrics.gainPct)} subColor={pctColor(metrics.gainPct)} />
            {metrics.ytdPct !== null && <MCard label="YTD" value={fmt2(metrics.ytdGain)} sub={fmtPct(metrics.ytdPct)} subColor={pctColor(metrics.ytdPct)} />}
            {metrics.monthPct !== null && <MCard label="Aquest mes" value={fmt2(metrics.monthGain)} sub={fmtPct(metrics.monthPct)} subColor={pctColor(metrics.monthPct)} />}
          </div>
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
                    <Line type="monotone" dataKey={fund.id} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} name={fund.name} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="empty">Cap entrada encara. Afegeix la primera!</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
        <div className="stats-title" style={{ margin: 0 }}>Historial d'entrades</div>
        <button className="btn-icon" style={{ color: 'var(--accent)' }} onClick={onAddEntry}><Plus size={20} /></button>
      </div>

      {metrics?.sortedEntries.slice().reverse().map(e => (
        <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>{e.date}</div>
            {e.amountAdded > 0 && <div style={{ fontSize: 12, color: 'var(--green)' }}>+{fmt2(e.amountAdded)} aportació</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt2(e.currentValue)}</div>
            <button className="btn-icon" style={{ color: 'var(--text2)' }} onClick={() => onDeleteEntry(e.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}

      {!metrics && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn-primary" onClick={onAddEntry}><Plus size={16} style={{ marginRight: 6 }} />Afegir primera entrada</button>
        </div>
      )}
    </div>
  )
}

// ── Portfolio view ────────────────────────────────────────────────────────
function PortfolioView({ funds, entries, loading, onSelectFund, onAddFund, onAddEntry, onRefresh }) {
  const portfolio = calcPortfolioMetrics(funds, entries)
  const chartData = useMemo(() => buildChartData(funds, entries), [funds, entries])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn-icon" onClick={onRefresh} title="Actualitzar">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {portfolio && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <MCard label="Valor cartera" value={fmt2(portfolio.currentValue)} />
            <MCard label="Total invertit" value={fmt(portfolio.totalInvested)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <MCard label="Guany total" value={fmt2(portfolio.gain)} sub={fmtPct(portfolio.gainPct)} subColor={pctColor(portfolio.gainPct)} />
            {portfolio.ytdPct !== null && <MCard label="YTD" value={fmt2(portfolio.ytdGain)} sub={fmtPct(portfolio.ytdPct)} subColor={pctColor(portfolio.ytdPct)} />}
            {portfolio.monthPct !== null && <MCard label="Aquest mes" value={fmt2(portfolio.monthGain)} sub={fmtPct(portfolio.monthPct)} subColor={pctColor(portfolio.monthPct)} />}
          </div>
        </>
      )}

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
                {funds.length > 1 && <Line type="monotone" dataKey="_total" stroke="var(--text2)" strokeWidth={2} strokeDasharray="4 2" dot={false} name="Total" connectNulls />}
                {funds.map((f, i) => (
                  <Line key={f.id} type="monotone" dataKey={f.id} stroke={COLORS[i % COLORS.length]} strokeWidth={2}
                    dot={{ r: 3, fill: COLORS[i % COLORS.length] }} name={f.name} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6, flexWrap: 'wrap' }}>
            {funds.length > 1 && <span><span style={{ color: 'var(--text2)' }}>- -</span> Total</span>}
            {funds.map((f, i) => <span key={f.id}><span style={{ color: COLORS[i % COLORS.length] }}>■</span> {f.name}</span>)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stats-title" style={{ margin: 0 }}>Els meus fons</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {funds.length > 0 && (
            <button className="btn-ghost small" onClick={onAddEntry} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Plus size={14} /> Entrada
            </button>
          )}
          <button className="btn-ghost small" onClick={onAddFund} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <Plus size={14} /> Fons
          </button>
        </div>
      </div>

      {loading && !funds.length && <p className="empty">Carregant…</p>}

      {!loading && !funds.length && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
          <div style={{ color: 'var(--text2)', marginBottom: 20, fontSize: 14 }}>Afegeix el teu primer fons d'inversió</div>
          <button className="btn-primary" onClick={onAddFund}><Plus size={16} style={{ marginRight: 6 }} />Afegir fons</button>
        </div>
      )}

      {funds.map((f, i) => {
        const m = calcFundMetrics(f, entries)
        return (
          <div key={f.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => onSelectFund(f.id, i)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
                </div>
                {f.isin && <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'monospace', marginLeft: 18 }}>{f.isin}</div>}
              </div>
              {m ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt2(m.currentValue)}</div>
                  <div style={{ fontSize: 12, color: pctColor(m.gainPct) }}>{fmtPct(m.gainPct)}</div>
                </div>
              ) : <div style={{ fontSize: 12, color: 'var(--text2)' }}>Sense dades</div>}
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedFundId, setSelectedFundId] = useState(null)
  const [selectedFundIdx, setSelectedFundIdx] = useState(0)
  const [showAddFund, setShowAddFund] = useState(false)
  const [editingFund, setEditingFund] = useState(null)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [addEntryFundId, setAddEntryFundId] = useState(null)

  const selectedFund = funds.find(f => f.id === selectedFundId) || null

  const fetchData = async () => {
    setLoading(true)
    try {
      const [f, e] = await Promise.all([getFunds(spreadsheetId), getInvEntries(spreadsheetId)])
      setFunds(f); setEntries(e)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (spreadsheetId) fetchData() }, [spreadsheetId])

  const handleAddFund = async ({ name, isin }) => {
    setSaving(true)
    try { const f = await addFund(spreadsheetId, { name, isin }); setFunds(prev => [...prev, f]) }
    catch (err) { console.error(err) }
    finally { setSaving(false); setShowAddFund(false) }
  }

  const handleEditFund = async ({ name, isin }) => {
    setSaving(true)
    try {
      const updated = { ...editingFund, name, isin }
      await updateFund(spreadsheetId, updated)
      setFunds(prev => prev.map(f => f.id === updated.id ? updated : f))
    } catch (err) { console.error(err) }
    finally { setSaving(false); setEditingFund(null) }
  }

  const handleDeleteFund = async (id) => {
    if (!window.confirm('Eliminar el fons i totes les seves entrades?')) return
    try {
      await deleteFund(spreadsheetId, id)
      const fundEntries = entries.filter(e => e.fundId === id)
      await Promise.all(fundEntries.map(e => deleteInvEntry(spreadsheetId, e.id)))
      setFunds(prev => prev.filter(f => f.id !== id))
      setEntries(prev => prev.filter(e => e.fundId !== id))
      setSelectedFundId(null)
    } catch (err) { console.error(err) }
  }

  const handleAddEntry = async ({ fundId, date, amountAdded, currentValue }) => {
    setSaving(true)
    try {
      const e = await addInvEntry(spreadsheetId, { fundId, date, amountAdded, currentValue })
      setEntries(prev => [...prev, e])
    } catch (err) { console.error(err) }
    finally { setSaving(false); setShowAddEntry(false) }
  }

  const handleDeleteEntry = async (id) => {
    try {
      await deleteInvEntry(spreadsheetId, id)
      setEntries(prev => prev.filter(e => e.id !== id))
    } catch (err) { console.error(err) }
  }

  return (
    <div>
      {selectedFund ? (
        <FundDetail
          fund={selectedFund}
          entries={entries}
          colorIdx={selectedFundIdx}
          onBack={() => setSelectedFundId(null)}
          onAddEntry={() => { setAddEntryFundId(selectedFund.id); setShowAddEntry(true) }}
          onDeleteEntry={handleDeleteEntry}
          onEditFund={() => setEditingFund(selectedFund)}
          onDeleteFund={() => handleDeleteFund(selectedFund.id)}
        />
      ) : (
        <PortfolioView
          funds={funds}
          entries={entries}
          loading={loading}
          onSelectFund={(id, idx) => { setSelectedFundId(id); setSelectedFundIdx(idx) }}
          onAddFund={() => setShowAddFund(true)}
          onAddEntry={() => { setAddEntryFundId(null); setShowAddEntry(true) }}
          onRefresh={fetchData}
        />
      )}

      {showAddFund && <AddFundModal onClose={() => setShowAddFund(false)} onSave={handleAddFund} saving={saving} />}
      {editingFund && <AddFundModal onClose={() => setEditingFund(null)} onSave={handleEditFund} initial={editingFund} saving={saving} />}
      {showAddEntry && funds.length > 0 && (
        <AddEntryModal funds={funds} initialFundId={addEntryFundId} onClose={() => setShowAddEntry(false)} onSave={handleAddEntry} saving={saving} />
      )}
    </div>
  )
}
