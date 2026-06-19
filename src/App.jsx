import { useState, useEffect, useCallback } from 'react'
import { Home, List, BarChart2, Tag, Plus, LogOut } from 'lucide-react'
import { loadGoogleAPIs, signIn, signOut, isSignedIn, initSheet, getTransactions } from './services/googleSheets'
import Dashboard from './components/Dashboard'
import AddTransaction from './components/AddTransaction'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import Categories from './components/Categories'
import Setup from './components/Setup'
import './App.css'

const TABS = ['inicio', 'lista', 'stats', 'cats']
const TAB_ICONS = { inicio: Home, lista: List, stats: BarChart2, cats: Tag }
const TAB_NAMES = { inicio: 'Inicio', lista: 'Lista', stats: 'Stats', cats: 'Cats' }

const DEFAULT_CATS = {
  gasto: [
    { name: 'Alimentación', icon: '🛒' }, { name: 'Transporte', icon: '🚗' },
    { name: 'Ocio', icon: '🎬' }, { name: 'Salud', icon: '💊' },
    { name: 'Ropa', icon: '👕' }, { name: 'Casa', icon: '🏠' },
    { name: 'Suscripciones', icon: '📱' }, { name: 'Restaurantes', icon: '🍽️' },
    { name: 'Viajes', icon: '✈️' }, { name: 'Otros', icon: '📦' },
  ],
  ingreso: [
    { name: 'Nómina', icon: '💵' }, { name: 'Trabajo', icon: '💼' },
    { name: 'Inversiones', icon: '📈' }, { name: 'Regalo', icon: '🎁' },
    { name: 'Otros', icon: '📦' },
  ],
}

function migrateCats(raw) {
  if (!raw) return DEFAULT_CATS
  const migrate = (arr) => arr.map(c => typeof c === 'string' ? { name: c, icon: '📦' } : c)
  return { gasto: migrate(raw.gasto || []), ingreso: migrate(raw.ingreso || []) }
}

function loadCats() {
  try { return migrateCats(JSON.parse(localStorage.getItem('gastos_cats') || 'null')) }
  catch { return DEFAULT_CATS }
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

  const handleSaveCats = (cats) => { localStorage.setItem('gastos_cats', JSON.stringify(cats)); setCategories(cats) }

  const onTransactionAdded = (tx) => { setTransactions((prev) => [tx, ...prev]); setShowAdd(false) }

  const onTransactionDeleted = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id))

  const onCategoryReassigned = (oldCat, newCat) => {
    setTransactions(prev => prev.map(t => t.categoria === oldCat ? { ...t, categoria: newCat } : t))
  }

  if (!config) return <Setup onSave={handleSaveConfig} />

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="app-logo">💰</div>
          <h1>Control de Gastos</h1>
          <p>Conecta tu cuenta de Google para acceder a tus datos en Google Sheets</p>
          {apisReady
            ? <button className="btn-primary btn-large" onClick={handleSignIn}>Conectar con Google</button>
            : <p className="loading-text">Cargando APIs…</p>}
          <button className="btn-ghost small" onClick={() => { localStorage.removeItem('gastos_config'); setConfig(null) }}>
            Cambiar configuración
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-title">💰 Gastos</span>
        <button className="btn-icon" onClick={handleSignOut} title="Salir"><LogOut size={18} /></button>
      </header>

      <main className="app-main">
        {tab === 'inicio' && <Dashboard transactions={transactions} loading={loading} onRefresh={fetchTransactions} categories={categories} />}
        {tab === 'lista' && <TransactionList transactions={transactions} spreadsheetId={config.spreadsheetId} onDeleted={onTransactionDeleted} loading={loading} categories={categories} />}
        {tab === 'stats' && <Stats transactions={transactions} />}
        {tab === 'cats' && <Categories categories={categories} onSave={handleSaveCats} transactions={transactions} spreadsheetId={config.spreadsheetId} onReassigned={onCategoryReassigned} />}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Añadir transacción">
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Modal añadir */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <AddTransaction
              spreadsheetId={config.spreadsheetId}
              onAdded={onTransactionAdded}
              categories={categories}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        </div>
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
