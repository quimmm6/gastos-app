import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, ChevronLeft, Trash2, X, Edit2, ChevronDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  getFunds, addFund, updateFund, deleteFund,
  getInvEntries, addInvEntry, updateInvEntry, deleteInvEntry,
  getInvValuations, addInvValuation, updateInvValuation, deleteInvValuation,
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

// ── DiaInput ──────────────────────────────────────────────────────────────
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
// entries: contributions (amountAdded), valuations: separate value records
function calcMonthBalance(contributions, allVals, ym) {
  const prevVals = allVals.filter(v => v.date.slice(0, 7) < ym)
  const prevVal = prevVals.length ? prevVals[prevVals.length - 1].value : 0
  const thisMonthAdded = contributions.filter(e => e.date.slice(0, 7) === ym).reduce((s, e) => s + e.amountAdded, 0)
  const thisMonthVals = allVals.filter(v => v.date.slice(0, 7) === ym)
  if (!thisMonthVals.length) return null
  const endVal = thisMonthVals[thisMonthVals.length - 1].value
  const base = prevVal + thisMonthAdded
  const gain = endVal - base
  const pct = base > 0 ? (gain / base) * 100 : null
  return { gain, pct }
}

function calcFundMetrics(fund, contributions, valuations) {
  const cs = contributions.filter(e => e.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  const vs = valuations.filter(v => v.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  const legacyVs = cs.filter(e => e.currentValue > 0).map(e => ({ fundId: e.fundId, date: e.date, value: e.currentValue, id: e.id + '_leg' }))
  const allVals = vs.length ? vs : legacyVs
  if (!cs.length && !allVals.length) return null

  const curYear = String(new Date().getFullYear())
  const totalInvested = cs.reduce((s, e) => s + e.amountAdded, 0)
  const latestVal = allVals.length ? allVals[allVals.length - 1].value : 0
  const gain = latestVal - totalInvested
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0

  // YTD
  const prevYearVals = allVals.filter(v => v.date.slice(0, 4) < curYear)
  const prevYearVal = prevYearVals.length ? prevYearVals[prevYearVals.length - 1].value : 0
  const thisYearAdded = cs.filter(e => e.date.slice(0, 4) === curYear).reduce((s, e) => s + e.amountAdded, 0)
  const ytdBase = prevYearVal + thisYearAdded
  const ytdGain = ytdBase > 0 ? latestVal - ytdBase : 0
  const ytdPct = ytdBase > 0 ? (ytdGain / ytdBase) * 100 : null

  return { totalInvested, currentValue: latestVal, gain, gainPct, ytdGain, ytdPct, sortedContributions: cs, sortedValuations: allVals, _cs: cs, _allVals: allVals }
}

function calcPortfolioMetrics(funds, contributions, valuations) {
  const mets = funds.map(f => calcFundMetrics(f, contributions, valuations)).filter(Boolean)
  if (!mets.length) return null
  const totalInvested = mets.reduce((s, m) => s + m.totalInvested, 0)
  const currentValue = mets.reduce((s, m) => s + m.currentValue, 0)
  const gain = currentValue - totalInvested
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0
  const ytdGain = mets.reduce((s, m) => s + (m.ytdGain || 0), 0)
  const ytdPcts = mets.filter(m => m.ytdPct !== null)
  const ytdPct = ytdPcts.length ? ytdPcts.reduce((s, m) => s + m.ytdPct, 0) / ytdPcts.length : null
  return { totalInvested, currentValue, gain, gainPct, ytdGain, ytdPct, _cs: contributions, _allVals: valuations, _funds: funds }
}

// Chart: invested (cumulative) vs value over time
function buildChartData(funds, contributions, valuations) {
  const allDates = [...new Set([
    ...contributions.map(e => e.date.slice(0, 7)),
    ...valuations.map(v => v.date.slice(0, 7)),
  ])].sort()
  if (!allDates.length) return []

  return allDates.map(ym => {
    let totalInvested = 0, totalValue = 0, hasAnyValue = false
    const point = { mes: ym2label(ym) }
    funds.forEach((f, i) => {
      const cs = contributions.filter(e => e.fundId === f.id && e.date.slice(0, 7) <= ym)
      const fundInvested = cs.reduce((s, e) => s + e.amountAdded, 0)
      totalInvested += fundInvested
      point[`inv_${i}`] = Math.round(fundInvested * 100) / 100
      const vs = valuations.filter(v => v.fundId === f.id && v.date.slice(0, 7) <= ym).sort((a, b) => a.date.localeCompare(b.date))
      const legVs = contributions.filter(e => e.fundId === f.id && e.date.slice(0, 7) <= ym && e.currentValue > 0).sort((a, b) => a.date.localeCompare(b.date))
      const allV = vs.length ? vs : legVs.map(e => ({ value: e.currentValue }))
      if (allV.length) {
        const v = Math.round(allV[allV.length - 1].value * 100) / 100
        point[`fons_${i}`] = v
        totalValue += v
        hasAnyValue = true
      }
    })
    point.invertit = Math.round(totalInvested * 100) / 100
    if (hasAnyValue) point.valor = Math.round(totalValue * 100) / 100
    return point
  })
}

// Per-fund chart: invested vs value
function buildFundChartData(fund, contributions, valuations) {
  const cs = contributions.filter(e => e.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  const vs = valuations.filter(v => v.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))
  const legVs = cs.filter(e => e.currentValue > 0).map(e => ({ date: e.date, value: e.currentValue }))
  const allVs = vs.length ? vs : legVs

  const allYMs = [...new Set([...cs.map(e => e.date.slice(0, 7)), ...allVs.map(v => v.date.slice(0, 7))])].sort()
  return allYMs.map(ym => {
    const cumCs = cs.filter(e => e.date.slice(0, 7) <= ym)
    const invested = cumCs.reduce((s, e) => s + e.amountAdded, 0)
    const valUpTo = allVs.filter(v => v.date.slice(0, 7) <= ym)
    const point = { mes: ym2label(ym), invertit: Math.round(invested * 100) / 100 }
    if (valUpTo.length) point.valor = Math.round(valUpTo[valUpTo.length - 1].value * 100) / 100
    return point
  })
}

// ── Sheet modal (portal) ──────────────────────────────────────────────────
function Sheet({ title, onClose, children }) {
  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

// ── Monthly breakdown (compact, % per fund) ───────────────────────────────
function MonthlyBreakdown({ contributions, valuations, funds }) {
  const [open, setOpen] = useState(false)

  const { rows, fundList } = useMemo(() => {
    const fundList = funds || []
    const isPortfolio = fundList.length > 0

    const allYMs = [...new Set([
      ...contributions.map(e => e.date.slice(0, 7)),
      ...valuations.map(v => v.date.slice(0, 7)),
    ])].sort().reverse()

    const rows = allYMs.map(ym => {
      if (isPortfolio) {
        const perFund = fundList.map(f => {
          const cs = contributions.filter(e => e.fundId === f.id)
          const vs = valuations.filter(v => v.fundId === f.id).sort((a, b) => a.date.localeCompare(b.date))
          return calcMonthBalance(cs, vs, ym)
        })
        if (!perFund.some(Boolean)) return null
        const totalGain = perFund.reduce((s, r) => s + (r ? r.gain : 0), 0)
        return { ym, perFund, totalGain }
      } else {
        const sortedVs = [...valuations].sort((a, b) => a.date.localeCompare(b.date))
        const r = calcMonthBalance(contributions, sortedVs, ym)
        if (!r) return null
        return { ym, perFund: [r], totalGain: r.gain }
      }
    }).filter(Boolean)

    return { rows, fundList }
  }, [contributions, valuations, funds])

  if (!rows.length) return null

  const isPortfolio = fundList.length > 0
  const cols = isPortfolio ? fundList : [null]
  // Mes | fund1% | fund2% | ... | Total€
  const gridCols = `50px ${cols.map(() => '1fr').join(' ')} 60px`

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: 'var(--text2)', fontSize: 11 }}>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s', flexShrink: 0 }} />
        Rendiment per mesos
      </button>
      {open && (
        <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '4px 6px', fontSize: 10, color: 'var(--text2)', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
            <span>Mes</span>
            {cols.map((f, i) => <span key={i} style={{ textAlign: 'right', color: f ? COLORS[i % COLORS.length] : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f ? f.name : '%'}</span>)}
            <span style={{ textAlign: 'right' }}>Total</span>
          </div>
          {rows.map(r => (
            <div key={r.ym} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '3px 6px', fontSize: 11, padding: '2px 0' }}>
              <span style={{ color: 'var(--text2)' }}>{ym2label(r.ym)}</span>
              {r.perFund.map((res, i) => (
                <span key={i} style={{ textAlign: 'right', fontWeight: 500, color: res ? pctColor(res.pct ?? res.gain) : 'var(--text2)' }}>
                  {res ? (res.pct !== null ? fmtPct(res.pct) : fmt2(res.gain)) : '—'}
                </span>
              ))}
              <span style={{ textAlign: 'right', fontWeight: 600, color: pctColor(r.totalGain) }}>{fmt2(r.totalGain)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Metric cards ──────────────────────────────────────────────────────────
function MetricRow({ metrics }) {
  if (!metrics) return null
  const { currentValue, totalInvested, gain, gainPct, ytdGain, ytdPct } = metrics
  const cardStyle = { padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 0 }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '86px 86px', gap: 10, marginBottom: 20 }}>
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>Valor actual</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 'auto' }}>{fmt2(currentValue)}</div>
      </div>
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>Total invertit</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 'auto' }}>{fmt2(totalInvested)}</div>
      </div>
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>Balanç total</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(gain), marginTop: 'auto' }}>{fmt2(gain)}</div>
        <div style={{ fontSize: 12, color: pctColor(gainPct) }}>{fmtPct(gainPct)}</div>
      </div>
      <div className="card" style={cardStyle}>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>YTD</div>
        {ytdPct !== null ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: pctColor(ytdGain), marginTop: 'auto' }}>{fmt2(ytdGain)}</div>
            <div style={{ fontSize: 12, color: pctColor(ytdPct) }}>{fmtPct(ytdPct)}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 'auto' }}>Sense dades</div>
        )}
      </div>
    </div>
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

function ContribForm({ funds, initialFundId, initial, onClose, onSave, saving }) {
  const [fundId, setFundId] = useState(initial?.fundId || initialFundId || funds[0]?.id || '')
  const [date, setDate] = useState(initial?.date || todayStr())
  const [amountAdded, setAmountAdded] = useState(initial ? String(initial.amountAdded) : '')
  const valid = fundId && date && amountAdded !== '' && parseFloat(amountAdded) > 0
  return (
    <Sheet title={initial ? 'Editar aportació' : 'Nova aportació'} onClose={onClose}>
      {!initial && (
        <div className="form-group">
          <label>Fons</label>
          <select value={fundId} onChange={e => setFundId(e.target.value)}>
            {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      <div className="form-group">
        <label>Data de l'aportació</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Import aportat (€)</label>
        <input type="number" min="0.01" step="0.01" placeholder="Ex: 200" value={amountAdded} onChange={e => setAmountAdded(e.target.value)} inputMode="decimal" />
      </div>
      <button className="btn-primary" disabled={!valid || saving}
        onClick={() => valid && onSave({ fundId, date, amountAdded: parseFloat(amountAdded) })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Desar aportació'}
      </button>
    </Sheet>
  )
}

function ValuationForm({ funds, initialFundId, initial, onClose, onSave, saving }) {
  const [fundId, setFundId] = useState(initial?.fundId || initialFundId || funds[0]?.id || '')
  const [date, setDate] = useState(initial?.date || todayStr())
  const [value, setValue] = useState(initial ? String(initial.value) : '')
  const valid = fundId && date && value !== ''
  return (
    <Sheet title={initial ? 'Editar valoració' : 'Nova valoració'} onClose={onClose}>
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
        <label>Valor total del fons en aquesta data (€)</label>
        <input type="number" min="0" step="0.01" placeholder="Ex: 1245,30" value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" />
      </div>
      <button className="btn-primary" disabled={!valid || saving}
        onClick={() => valid && onSave({ fundId, date, value: parseFloat(value) })}>
        {saving ? 'Desant…' : initial ? 'Desar canvis' : 'Desar valoració'}
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
          S'aplicarà automàticament. Introdueix el valor del fons quan vulguis.
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

// ── History list with show-more ───────────────────────────────────────────
function HistoryList({ items, renderItem, onAdd, title, emptyLabel }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, 3)
  return (
    <div className="stats-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stats-title" style={{ margin: 0 }}>{title}</div>
        <button className="btn-icon" style={{ color: 'var(--accent)' }} onClick={onAdd}><Plus size={19} /></button>
      </div>
      {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>{emptyLabel}</p>}
      {visible.map(renderItem)}
      {items.length > 3 && (
        <button className="btn-ghost small" style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          onClick={() => setShowAll(s => !s)}>
          <ChevronDown size={14} style={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          {showAll ? 'Veure menys' : `Veure ${items.length - 3} més`}
        </button>
      )}
    </div>
  )
}

// ── Fund Detail ───────────────────────────────────────────────────────────
function FundDetail({ fund, contributions, valuations, recFunds, colorIdx, onBack, onAddContrib, onEditContrib, onDeleteContrib, onAddVal, onEditVal, onDeleteVal, onEditFund, onDeleteFund, onAddRec, onEditRec, onToggleRec, onDeleteRec }) {
  const metrics = calcFundMetrics(fund, contributions, valuations)
  const chartData = buildFundChartData(fund, contributions, valuations)
  const color = COLORS[colorIdx % COLORS.length]
  const myRecs = recFunds.filter(r => r.fundId === fund.id)
  const myContribs = contributions.filter(e => e.fundId === fund.id).sort((a, b) => b.date.localeCompare(a.date))
  const myVals = [...(valuations.filter(v => v.fundId === fund.id))].sort((a, b) => b.date.localeCompare(a.date))

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
      {!metrics && <p className="empty" style={{ marginBottom: 20 }}>Sense dades. Afegeix una aportació o valoració!</p>}

      {chartData.length > 1 && (
        <div className="stats-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="stats-title" style={{ margin: 0 }}>Evolució</div>
          </div>
          <MonthlyBreakdown
            contributions={contributions.filter(e => e.fundId === fund.id)}
            valuations={valuations.filter(v => v.fundId === fund.id).sort((a, b) => a.date.localeCompare(b.date))}
            funds={null}
          />
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }}
                  formatter={(v, name) => [fmt2(v), name]} />
                <Line type="monotone" dataKey="invertit" name="Invertit" stroke={cssVar('--text2')} strokeWidth={2} strokeDasharray="4 2" dot={false} connectNulls />
                <Line type="monotone" dataKey="valor" name="Valor real" stroke={color} strokeWidth={2.5} dot={{ r: 3.5, fill: color }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
            <span>— Invertit</span>
            <span><span style={{ color }}>■</span> Valor real</span>
          </div>
        </div>
      )}

      {/* Recurring */}
      <div className="stats-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="stats-title" style={{ margin: 0 }}>Aportacions recurrents</div>
          <button className="btn-icon" style={{ color: 'var(--accent)' }} onClick={onAddRec}><Plus size={19} /></button>
        </div>
        {myRecs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text2)' }}>Cap configurada.</p>}
        {myRecs.map(r => (
          <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 8, opacity: r.activa ? 1 : 0.55 }}>
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

      {/* Contributions history */}
      <HistoryList
        title="Aportacions"
        items={myContribs}
        onAdd={onAddContrib}
        emptyLabel="Cap aportació registrada."
        renderItem={c => (
          <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.date}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>+{fmt2(c.amountAdded)}</div>
              <button className="btn-icon" onClick={() => onEditContrib(c)}><Edit2 size={14} /></button>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => onDeleteContrib(c.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        )}
      />

      {/* Valuations history */}
      <HistoryList
        title="Valoracions"
        items={myVals}
        onAdd={onAddVal}
        emptyLabel="Cap valoració registrada."
        renderItem={v => (
          <div key={v.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{v.date}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt2(v.value)}</div>
              <button className="btn-icon" onClick={() => onEditVal(v)}><Edit2 size={14} /></button>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => onDeleteVal(v.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        )}
      />

    </div>
  )
}

// ── Portfolio view ────────────────────────────────────────────────────────
function PortfolioView({ funds, contributions, valuations, loading, onSelectFund, onAddFund }) {
  const [chartMode, setChartMode] = useState('individual') // 'individual' | 'total'
  const portfolio = calcPortfolioMetrics(funds, contributions, valuations)
  const chartData = useMemo(() => buildChartData(funds, contributions, valuations), [funds, contributions, valuations])

  return (
    <div>
      <MetricRow metrics={portfolio} />

      {chartData.length > 1 && (
        <div className="stats-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="stats-title" style={{ margin: 0 }}>Evolució cartera</div>
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 2, gap: 2 }}>
              {[['individual', 'Per fons'], ['total', 'Total']].map(([v, l]) => (
                <button key={v} onClick={() => setChartMode(v)}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, border: 'none', cursor: 'pointer', background: chartMode === v ? 'var(--bg2)' : 'transparent', color: chartMode === v ? 'var(--text1)' : 'var(--text2)', fontWeight: chartMode === v ? 600 : 400, boxShadow: chartMode === v ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <MonthlyBreakdown contributions={contributions} valuations={valuations} funds={funds} />
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis dataKey="mes" tick={{ fill: cssVar('--chart-tick'), fontSize: 11 }} />
                <YAxis tick={{ fill: cssVar('--chart-tick'), fontSize: 10 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={{ background: cssVar('--tooltip-bg'), border: `1px solid ${cssVar('--tooltip-border')}`, borderRadius: 8, fontSize: 12, color: cssVar('--text1') }}
                  formatter={(v, name) => [fmt2(v), name]} />
                {chartMode === 'individual'
                  ? funds.flatMap((f, i) => [
                    <Line key={`inv_${i}`} type="monotone" dataKey={`inv_${i}`} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls name={`${f.name} inv.`} />,
                    <Line key={`fons_${i}`} type="monotone" dataKey={`fons_${i}`} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: COLORS[i % COLORS.length] }} connectNulls name={f.name} />,
                  ])
                  : [
                    <Line key="invertit" type="monotone" dataKey="invertit" stroke={cssVar('--text2')} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls name="Invertit" />,
                    <Line key="valor" type="monotone" dataKey="valor" stroke="var(--accent-light)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent-light)' }} connectNulls name="Valor real" />,
                  ]
                }
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
            {chartMode === 'individual'
              ? funds.map((f, i) => <span key={f.id}><span style={{ color: COLORS[i % COLORS.length] }}>■</span> {f.name}</span>)
              : <><span style={{ color: 'var(--text2)' }}>— Invertit</span><span><span style={{ color: 'var(--accent-light)' }}>■</span> Valor real</span></>
            }
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="stats-title" style={{ margin: 0 }}>Els meus fons</div>
        <button className="btn-ghost small" onClick={onAddFund} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={13} /> Fons
        </button>
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
        const m = calcFundMetrics(f, contributions, valuations)
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
                <span>Balanç <strong style={{ color: pctColor(m.gain) }}>{fmt2(m.gain)}</strong></span>
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
  const [contributions, setContributions] = useState([])
  const [valuations, setValuations] = useState([])
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
      const [f, c, v, r, newContribs] = await Promise.all([
        getFunds(spreadsheetId), getInvEntries(spreadsheetId), getInvValuations(spreadsheetId),
        getRecFunds(spreadsheetId), applyRecurringContributions(spreadsheetId),
      ])
      setFunds(f); setValuations(v); setRecFunds(r)
      const allC = [...c]
      newContribs.forEach(nc => { if (!allC.find(x => x.id === nc.id)) allC.push(nc) })
      setContributions(allC)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (spreadsheetId) fetchData() }, [spreadsheetId])

  const close = () => { setModal(null); setEditTarget(null) }

  // Fund CRUD
  const handleAddFund = async ({ name, isin }) => {
    setSaving(true)
    try { const f = await addFund(spreadsheetId, { name, isin }); setFunds(p => [...p, f]); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditFund = async ({ name, isin }) => {
    setSaving(true)
    try { const u = { ...selectedFund, name, isin }; await updateFund(spreadsheetId, u); setFunds(p => p.map(f => f.id === u.id ? u : f)); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleDeleteFund = async (id) => {
    if (!window.confirm('Eliminar el fons i totes les dades associades?')) return
    try {
      await deleteFund(spreadsheetId, id)
      const cs = contributions.filter(e => e.fundId === id)
      const vs = valuations.filter(v => v.fundId === id)
      const rs = recFunds.filter(r => r.fundId === id)
      await Promise.all([...cs.map(e => deleteInvEntry(spreadsheetId, e.id)), ...vs.map(v => deleteInvValuation(spreadsheetId, v.id)), ...rs.map(r => deleteRecFund(spreadsheetId, r.id))])
      setFunds(p => p.filter(f => f.id !== id)); setContributions(p => p.filter(e => e.fundId !== id))
      setValuations(p => p.filter(v => v.fundId !== id)); setRecFunds(p => p.filter(r => r.fundId !== id))
      setSelectedFundId(null)
    } catch (e) { console.error(e) }
  }

  // Contribution CRUD
  const handleAddContrib = async ({ fundId, date, amountAdded }) => {
    setSaving(true)
    try { const e = await addInvEntry(spreadsheetId, { fundId, date, amountAdded, currentValue: 0 }); setContributions(p => [...p, e]); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditContrib = async ({ date, amountAdded }) => {
    setSaving(true)
    try { const u = { ...editTarget, date, amountAdded }; await updateInvEntry(spreadsheetId, u); setContributions(p => p.map(e => e.id === u.id ? u : e)); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleDeleteContrib = async (id) => {
    try { await deleteInvEntry(spreadsheetId, id); setContributions(p => p.filter(e => e.id !== id)) }
    catch (e) { console.error(e) }
  }

  // Valuation CRUD
  const handleAddVal = async ({ fundId, date, value }) => {
    setSaving(true)
    try { const v = await addInvValuation(spreadsheetId, { fundId, date, value }); setValuations(p => [...p, v]); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditVal = async ({ date, value }) => {
    setSaving(true)
    try { const u = { ...editTarget, date, value }; await updateInvValuation(spreadsheetId, u); setValuations(p => p.map(v => v.id === u.id ? u : v)); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleDeleteVal = async (id) => {
    try { await deleteInvValuation(spreadsheetId, id); setValuations(p => p.filter(v => v.id !== id)) }
    catch (e) { console.error(e) }
  }

  // Recurring CRUD
  const handleAddRec = async (rec) => {
    setSaving(true)
    try { const r = await addRecFund(spreadsheetId, { ...rec, activa: true }); setRecFunds(p => [...p, r]); close(); fetchData() }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }
  const handleEditRec = async (rec) => {
    setSaving(true)
    try { const u = { ...editTarget, ...rec }; await updateRecFund(spreadsheetId, u); setRecFunds(p => p.map(r => r.id === u.id ? u : r)); close() }
    catch (e) { console.error(e) } finally { setSaving(false) }
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

  const selFundId = selectedFund?.id || funds[0]?.id

  return (
    <div>
      {selectedFund ? (
        <FundDetail
          fund={selectedFund} contributions={contributions} valuations={valuations} recFunds={recFunds} colorIdx={selectedFundIdx}
          onBack={() => setSelectedFundId(null)}
          onAddContrib={() => setModal('addContrib')}
          onEditContrib={e => { setEditTarget(e); setModal('editContrib') }}
          onDeleteContrib={handleDeleteContrib}
          onAddVal={() => setModal('addVal')}
          onEditVal={v => { setEditTarget(v); setModal('editVal') }}
          onDeleteVal={handleDeleteVal}
          onEditFund={() => setModal('editFund')}
          onDeleteFund={() => handleDeleteFund(selectedFund.id)}
          onAddRec={() => setModal('addRec')}
          onEditRec={r => { setEditTarget(r); setModal('editRec') }}
          onToggleRec={handleToggleRec}
          onDeleteRec={handleDeleteRec}
        />
      ) : (
        <PortfolioView
          funds={funds} contributions={contributions} valuations={valuations} loading={loading}
          onSelectFund={(id, idx) => { setSelectedFundId(id); setSelectedFundIdx(idx) }}
          onAddFund={() => setModal('addFund')}
        />
      )}

      {modal === 'addFund' && <FundForm onClose={close} onSave={handleAddFund} saving={saving} />}
      {modal === 'editFund' && selectedFund && <FundForm initial={selectedFund} onClose={close} onSave={handleEditFund} saving={saving} />}
      {modal === 'addContrib' && funds.length > 0 && <ContribForm funds={funds} initialFundId={selFundId} onClose={close} onSave={handleAddContrib} saving={saving} />}
      {modal === 'editContrib' && editTarget && <ContribForm funds={funds} initial={editTarget} onClose={close} onSave={handleEditContrib} saving={saving} />}
      {modal === 'addVal' && funds.length > 0 && <ValuationForm funds={funds} initialFundId={selFundId} onClose={close} onSave={handleAddVal} saving={saving} />}
      {modal === 'editVal' && editTarget && <ValuationForm funds={funds} initial={editTarget} onClose={close} onSave={handleEditVal} saving={saving} />}
      {modal === 'addRec' && selectedFund && <RecForm fund={selectedFund} onClose={close} onSave={handleAddRec} saving={saving} />}
      {modal === 'editRec' && editTarget && selectedFund && <RecForm fund={selectedFund} initial={editTarget} onClose={close} onSave={handleEditRec} saving={saving} />}
    </div>
  )
}
