import { useState, useEffect, useCallback } from 'react'
import { loadGoogleAPIs, signIn, signOut, isSignedIn, initSheet, getTransactions } from './services/googleSheets'
import Dashboard from './components/Dashboard'
import AddTransaction from './components/AddTransaction'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import Categories from './components/Categories'
import Setup from './components/Setup'
import './App.css'

const TABS = ['inicio', 'añadir', 'lista', 'stats', 'cats']
const TAB_LABELS = { inicio: '🏠', añadir: '➕', lista: '📋', stats: '📊', cats: '🏷️' }
const TAB_NAMES = { inicio: 'Inicio', añadir: 'Añadir', lista: 'Lista', stats: 'Stats', cats: 'Cats' }

const DEFAULT_CATS = {
  gasto: ['Alimentación', 'Transporte', 'Ocio', 'Salud', 'Ropa', 'Casa', 'Suscripciones', 'Restaurantes', 'Viajes', 'Otros'],
  ingreso: ['Nómina', 'Trabajo', 'Inversiones', 'Regalo', 'Otros'],
}

function loadCats() {
  try { return JSON.parse(localStorage.getItem('gastos_cats') || 'null') || DEFAULT_CATS } catch { return DEFAULT_CATS }
}

export default function App() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gastos_config') || 'null') } catch { return null }
  })
  const [authed, setAuthed] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('inicio')
  const [apisReady, setApisReady] = useState(false)
  const [categories, setCategories] = useState(loadCats)

  useEffect(() => {
    if (!config) return
    loadGoogleAPIs(config.clientId, config.apiKey).then(() => {
      setApisReady(true)
      if (isSignedIn()) {
        setAuthed(true)
        fetchTransactions()
      }
    })
  }, [config])

  const fetchTransactions = useCallback(async () => {
    if (!config) return
    setLoading(true)
    try {
      await initSheet(config.spreadsheetId)
      const txs = await getTransactions(config.spreadsheetId)
      setTransactions(txs.reverse())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [config])

  const handleSignIn = async () => {
    try {
      await signIn()
      setAuthed(true)
      await fetchTransactions()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSignOut = () => {
    signOut()
    setAuthed(false)
    setTransactions([])
  }

  const handleSaveConfig = (cfg) => {
    localStorage.setItem('gastos_config', JSON.stringify(cfg))
    setConfig(cfg)
  }

  const handleSaveCats = (cats) => {
    localStorage.setItem('gastos_cats', JSON.stringify(cats))
    setCategories(cats)
  }

  const onTransactionAdded = (tx) => {
    setTransactions((prev) => [tx, ...prev])
    setTab('inicio')
  }

  const onTransactionDeleted = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  if (!config) return <Setup onSave={handleSaveConfig} />

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="app-logo">💰</div>
          <h1>Control de Gastos</h1>
          <p>Conecta tu cuenta de Google para acceder a tus datos en Google Sheets</p>
          {apisReady ? (
            <button className="btn-primary btn-large" onClick={handleSignIn}>
              Conectar con Google
            </button>
          ) : (
            <p className="loading-text">Cargando APIs…</p>
          )}
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
        <button className="btn-ghost small" onClick={handleSignOut}>Salir</button>
      </header>

      <main className="app-main">
        {tab === 'inicio' && <Dashboard transactions={transactions} loading={loading} onRefresh={fetchTransactions} />}
        {tab === 'añadir' && (
          <AddTransaction
            spreadsheetId={config.spreadsheetId}
            onAdded={onTransactionAdded}
            categories={categories}
          />
        )}
        {tab === 'lista' && (
          <TransactionList
            transactions={transactions}
            spreadsheetId={config.spreadsheetId}
            onDeleted={onTransactionDeleted}
            loading={loading}
          />
        )}
        {tab === 'stats' && <Stats transactions={transactions} />}
        {tab === 'cats' && <Categories categories={categories} onSave={handleSaveCats} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`nav-item ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            <span className="nav-icon">{TAB_LABELS[t]}</span>
            <span className="nav-label">{TAB_NAMES[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
