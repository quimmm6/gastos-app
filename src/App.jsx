import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Home, List, BarChart2, Tag, Plus, LogOut, Moon, Sun } from 'lucide-react'
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

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

// Animated splash logo SVG
function SplashLogo({ size = 120 }) {
  const k = size / 40
  const cx = 17 * k, cy = 17 * k, r = 12.5 * k
  const circ = Math.round(2 * Math.PI * r)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} stroke="#818cf8" strokeWidth={2.8 * k}
        strokeDasharray={circ} strokeDashoffset={circ}
        style={{ animation: 'drawQ 1.2s ease forwards' }} />
      <line x1={22*k} y1={22*k} x2={33*k} y2={33*k}
        stroke="#818cf8" strokeWidth={3.2 * k} strokeLinecap="round"
        strokeDasharray={20 * k} strokeDashoffset={20 * k}
        style={{ animation: 'drawQtail 0.4s 1.0s ease forwards' }} />
      <polyline points={[[10,20],[13.5,15],[17,18],[21,12]].map(([x,y]) => `${x*k},${y*k}`).join(' ')}
        stroke="white" strokeWidth={2 * k} strokeLinecap="round" strokeLinejoin="round"
        fill="none" opacity="0"
        strokeDasharray={50 * k} strokeDashoffset={50 * k}
        style={{ animation: 'drawQchart 0.5s 0.5s ease forwards, fadeIn 0.5s 0.5s ease forwards' }} />
    </svg>
  )
}

export default function App() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gastos_config') || 'null') } catch { return null }
  })
  const [authState, setAuthState] = useState('splash') // 'splash' | 'tryAuto' | 'ready' | 'authed'
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('inicio')
  const [tabAnimKey, setTabAnimKey] = useState(0)
  const [tabSlideDir, setTabSlideDir] = useState('left')
  const [showAdd, setShowAdd] = useState(false)
  const [categories, setCategories] = useState(loadCats)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('gastos_theme')
    return saved !== null ? saved === 'dark' : true
  })

  useEffect(() => { applyTheme(darkMode) }, [darkMode])

  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('gastos_theme', next ? 'dark' : 'light')
  }

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

  useEffect(() => {
    if (!config) return
    setAuthState('splash')
    // Show splash for at least 1.8s while APIs load
    const splashTimer = setTimeout(() => {
      setAuthState(prev => prev === 'splash' ? 'tryAuto' : prev)
    }, 1800)

    loadGoogleAPIs(config.clientId, config.apiKey).then(async () => {
      if (isSignedIn()) {
        clearTimeout(splashTimer)
        setAuthState('authed')
        fetchTransactions()
        return
      }
      // Try silent first, then auto-popup (no button needed)
      const tryAuth = async () => {
        try {
          await signIn('none')
          return true
        } catch {}
        try {
          // Auto-trigger popup: if user has active Google session it closes itself
          await signIn('')
          return true
        } catch {
          return false
        }
      }
      const ok = await tryAuth()
      clearTimeout(splashTimer)
      if (ok) {
        setAuthState('authed')
        fetchTransactions()
      } else {
        setAuthState('ready') // fallback: show button
      }
    })

    return () => clearTimeout(splashTimer)
  }, [config])

  // Once splash timer fires, check if APIs resolved
  useEffect(() => {
    if (authState === 'tryAuto') setAuthState('ready')
  }, [authState])

  const handleSignIn = async () => {
    try { await signIn(); setAuthState('authed'); await fetchTransactions() }
    catch (e) { console.error(e) }
  }

  const handleSignOut = () => { signOut(); setAuthState('ready'); setTransactions([]) }
  const handleSaveConfig = (cfg) => { localStorage.setItem('gastos_config', JSON.stringify(cfg)); setConfig(cfg) }
  const handleSaveCats = (cats) => {
    localStorage.setItem('gastos_cats', JSON.stringify(cats))
    localStorage.setItem('gastos_cats_v', String(CATS_VERSION))
    setCategories(cats)
  }
  const mainSwipeX = useRef(null)
  const goTab = (newTab, dir) => { setTabSlideDir(dir); setTabAnimKey(k => k + 1); setTab(newTab) }
  const onMainTouchStart = (e) => { mainSwipeX.current = e.touches[0].clientX }
  const onMainTouchEnd = (e) => {
    if (mainSwipeX.current === null) return
    const dx = e.changedTouches[0].clientX - mainSwipeX.current
    mainSwipeX.current = null
    if (Math.abs(dx) < 120) return
    const curIdx = TABS.indexOf(tab)
    if (dx < 0 && curIdx < TABS.length - 1) goTab(TABS[curIdx + 1], 'left')
    if (dx > 0 && curIdx > 0) goTab(TABS[curIdx - 1], 'right')
  }

  const onTransactionAdded = (tx) => { setTransactions((prev) => [tx, ...prev]); setShowAdd(false) }
  const onTransactionDeleted = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id))
  const onTransactionUpdated = (updated) => setTransactions((prev) => prev.map(t => t.id === updated.id ? updated : t))
  const onCategoryReassigned = (oldCat, newCat) => {
    setTransactions(prev => prev.map(t => t.categoria === oldCat ? { ...t, categoria: newCat } : t))
  }

  if (!config) return <Setup onSave={handleSaveConfig} />

  if (authState === 'authed') {
    return (
      <div className="app">
        <header className="app-header">
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text1)', cursor: 'pointer', padding: 0 }} onClick={() => setTab('inicio')}>
            <Logo size={42} />
            <span className="header-title" style={{ fontSize: 26, letterSpacing: '-0.5px' }}>FinQuim</span>
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={toggleTheme} title="Canviar tema">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-icon" onClick={handleSignOut} title="Sortir"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="app-main" onTouchStart={onMainTouchStart} onTouchEnd={onMainTouchEnd}>
          <div key={tabAnimKey} className={`page-slide page-slide-${tabSlideDir}`}>
            {tab === 'inicio' && <Dashboard transactions={transactions} loading={loading} onRefresh={fetchTransactions} categories={categories} />}
            {tab === 'lista' && <TransactionList transactions={transactions} spreadsheetId={config.spreadsheetId} onDeleted={onTransactionDeleted} onUpdated={onTransactionUpdated} loading={loading} categories={categories} />}
            {tab === 'stats' && <Stats transactions={transactions} />}
            {tab === 'cats' && <Categories categories={categories} onSave={handleSaveCats} transactions={transactions} spreadsheetId={config.spreadsheetId} onReassigned={onCategoryReassigned} />}
          </div>
        </main>

        <button className="fab" onClick={() => setShowAdd(true)} aria-label="Afegir transacció">
          <Plus size={26} strokeWidth={2.5} />
        </button>

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
              <button key={t} className={`nav-item ${tab === t ? 'active' : ''}`} onClick={() => { const d = TABS.indexOf(t) > TABS.indexOf(tab) ? 'left' : 'right'; goTab(t, d) }}>
                <Icon size={22} strokeWidth={tab === t ? 2.2 : 1.6} />
                <span className="nav-label">{TAB_NAMES[t]}</span>
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  // Splash + login screen
  return (
    <div className="splash-screen">
      <div className={`splash-content ${authState === 'ready' ? 'splash-ready' : ''}`}>
        <div className="splash-logo">
          <SplashLogo size={120} />
        </div>
        <div className="splash-brand">
          <div className="splash-name">FinQuim</div>
          <div className="splash-sub">Control de Despeses</div>
        </div>

        <div className={`splash-actions ${authState === 'ready' ? 'splash-actions-visible' : ''}`}>
          <button className="btn-primary btn-large splash-btn" onClick={handleSignIn}>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
              <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connectar amb Google
          </button>
          <button className="btn-ghost small" style={{ marginTop: 8 }} onClick={() => { localStorage.removeItem('gastos_config'); setConfig(null) }}>
            Canviar configuració
          </button>
        </div>

        {authState === 'splash' && (
          <div className="splash-loading">
            <div className="splash-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { BottomSheet }
