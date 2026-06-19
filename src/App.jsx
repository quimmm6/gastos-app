import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Home, List, BarChart2, Tag, Plus, LogOut } from 'lucide-react'
import { loadGoogleAPIs, signIn, signOut, isSignedIn, initSheet, getTransactions } from './services/googleSheets'
import Dashboard from './components/Dashboard'
import AddTransaction from './components/AddTransaction'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import Categories from './components/Categories'
import Setup from './components/Setup'
import Logo from './components/Logo'
import BottomSheet from './components/BottomSheet'
import './App.css'

const TABS = ['inicio', 'lista', 'stats', 'cats']
const TAB_ICONS = { inicio: Home, lista: List, stats: BarChart2, cats: Tag }
const TAB_NAMES = { inicio: 'Inici', lista: 'Llista', stats: 'Stats', cats: 'Cats' }

const DEFAULT_CATS = {
  gasto: [
    { name: 'Bar', icon: '🍻' },
    { name: 'Àpats', icon: '🍴' },
    { name: 'Restaurants', icon: '🍽️' },
    { name: 'Cafè', icon: '☕' },
    { name: 'Supermercat', icon: '🛒' },
    { name: 'Gasolina', icon: '⛽' },
    { name: 'Transport', icon: '🚅' },
    { name: 'Vehicles', icon: '🔧' },
    { name: 'Subscripcions', icon: '☁️' },
    { name: 'Oci', icon: '🥳' },
    { name: 'Roba', icon: '🛍️' },
    { name: 'Viatges', icon: '🛫' },
    { name: 'Regals', icon: '🎁' },
    { name: 'Self-care', icon: '❤️' },
    { name: 'Compartit', icon: '👥' },
    { name: 'Compensació Targeta', icon: '💳' },
    { name: 'Altres', icon: '📌' },
  ],
  ingreso: [
    { name: 'Nòmina', icon: '💶' },
    { name: 'Dietes', icon: '💰' },
    { name: 'Targeta Despeses', icon: '💳' },
    { name: 'Regal Personal', icon: '🎁' },
  ],
}
const CATS_VERSION = 2

function migrateCats(raw) {
  if (!raw) return DEFAULT_CATS
  const migrate = (arr) => arr.map(c => typeof c === 'string' ? { name: c, icon: '📦' } : c)
  return { gasto: migrate(raw.gasto || []), ingreso: migrate(raw.ingreso || []) }
}

function loadCats() {
  try {
    const stored = JSON.parse(localStorage.getItem('gastos_cats') || 'null')
    const version = parseInt(localStorage.getItem('gastos_cats_v') || '0')
    if (!stored || version < CATS_VERSION) return DEFAULT_CATS
    return migrateCats(stored)
  } catch { return DEFAULT_CATS }
}

export default function App() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gastos_config') || 'null') } catch { return null }
  })
  const [authed, setAuthed] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('inicio')
  const [showAdd, setShowAdd] = useState(false)
  const [apisReady, setApisReady] = useState(false)
  const [categories, setCategories] = useState(loadCats)

  useEffect(() => {
    if (!config) return
    loadGoogleAPIs(config.clientId, config.apiKey).then(() => {
      setApisReady(true)
      if (isSignedIn()) { setAuthed(true); fetchTransactions() }
    })
  }, [config])

  const fetchTransactions = useCallback(async () => {
    if (!config) return
    setLoading(true)
    try {
      await initSheet(config.spreadsheetId)
      const txs = await getTransactions(config.spreadsheetId)
      setTransactions(txs.reverse())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [config])

  const handleSignIn = async () => {
    try { await signIn(); setAuthed(true); await fetchTransactions() }
    catch (e) { console.error(e) }
  }

  const handleSignOut = () => { signOut(); setAuthed(false); setTransactions([]) }
  const handleSaveConfig = (cfg) => { localStorage.setItem('gastos_config', JSON.stringify(cfg)); setConfig(cfg) }
  const handleSaveCats = (cats) => {
    localStorage.setItem('gastos_cats', JSON.stringify(cats))
    localStorage.setItem('gastos_cats_v', String(CATS_VERSION))
    setCategories(cats)
  }
  const onTransactionAdded = (tx) => { setTransactions((prev) => [tx, ...prev]); setShowAdd(false) }
  const onTransactionDeleted = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id))
  const onTransactionUpdated = (updated) => setTransactions((prev) => prev.map(t => t.id === updated.id ? updated : t))
  const onCategoryReassigned = (oldCat, newCat) => {
    setTransactions(prev => prev.map(t => t.categoria === oldCat ? { ...t, categoria: newCat } : t))
  }

  if (!config) return <Setup onSave={handleSaveConfig} />

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo-wrap">
            <Logo size={72} />
          </div>
          <div className="auth-brand">
            <div className="auth-brand-name">FinQuim</div>
            <div className="auth-brand-sub">Control de Despeses</div>
          </div>
          <div className="auth-divider" />
          <p className="auth-desc">Connecta el teu compte de Google per accedir a les teves dades</p>
          {apisReady
            ? <button className="btn-primary btn-large" onClick={handleSignIn}>
                <span style={{ marginRight: 8, fontSize: 18 }}>G</span> Connectar amb Google
              </button>
            : <div className="auth-loading"><span className="auth-spinner" />Carregant…</div>}
          <button className="btn-ghost small" onClick={() => { localStorage.removeItem('gastos_config'); setConfig(null) }}>
            Canviar configuració
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text1)', cursor: 'pointer', padding: 0 }} onClick={() => setTab('inicio')}>
          <Logo size={28} />
          <span className="header-title">FinQuim</span>
        </button>
        <button className="btn-icon" onClick={handleSignOut} title="Sortir"><LogOut size={18} /></button>
      </header>

      <main className="app-main">
        {tab === 'inicio' && <Dashboard transactions={transactions} loading={loading} onRefresh={fetchTransactions} categories={categories} />}
        {tab === 'lista' && <TransactionList transactions={transactions} spreadsheetId={config.spreadsheetId} onDeleted={onTransactionDeleted} onUpdated={onTransactionUpdated} loading={loading} categories={categories} />}
        {tab === 'stats' && <Stats transactions={transactions} />}
        {tab === 'cats' && <Categories categories={categories} onSave={handleSaveCats} transactions={transactions} spreadsheetId={config.spreadsheetId} onReassigned={onCategoryReassigned} />}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Afegir transacció">
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Modal afegir — portal per evitar que quedi tallat */}
      {showAdd && createPortal(
        <BottomSheet onClose={() => setShowAdd(false)}>
          <AddTransaction
            spreadsheetId={config.spreadsheetId}
            onAdded={onTransactionAdded}
            categories={categories}
            onCancel={() => setShowAdd(false)}
          />
        </BottomSheet>,
        document.body
      )}

      <nav className="bottom-nav">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t]
          return (
            <button key={t} className={`nav-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              <Icon size={22} strokeWidth={tab === t ? 2.2 : 1.6} />
              <span className="nav-label">{TAB_NAMES[t]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export { BottomSheet }
