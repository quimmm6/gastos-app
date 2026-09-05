import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { createPortal } from 'react-dom'
import { Home, List, BarChart2, Plus, LogOut, Moon, Sun, LayoutDashboard, TrendingUp, Settings } from 'lucide-react'
import { onAuthChanged, signIn, signOut, isAllowedEmail, getTransactions, getCategories, saveCategories, applyRecurrents } from './services/firebase'
import { DEMO_TRANSACTIONS, DEMO_CATEGORIES, DEMO_RECURRENTS } from './demoData'
import Dashboard from './components/Dashboard'
import AddTransaction from './components/AddTransaction'
import TransactionList from './components/TransactionList'
import Stats from './components/Stats'
import Inversions from './components/Inversions'
import Categories from './components/Categories'
import Logo from './components/Logo'
import BottomSheet from './components/BottomSheet'
import './App.css'

const ALL_TABS = ['add', 'inicio', 'lista', 'stats', 'inv']
const TAB_ICONS = { add: Plus, inicio: LayoutDashboard, lista: List, stats: BarChart2, inv: TrendingUp }
const TAB_NAMES = { add: 'Afegir', inicio: 'Resum', lista: 'Llista', stats: 'Stats', inv: 'Inversions' }

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

const PINK_EMAIL = 'claravalenti07@gmail.com'

function applyTheme(dark, pink) {
  document.documentElement.setAttribute('data-theme',
    pink ? (dark ? 'dark-pink' : 'light-pink') : (dark ? 'dark' : 'light')
  )
}

// Animated splash logo SVG
function SplashLogo({ size = 120 }) {
  const k = size / 40
  const cx = 17 * k, cy = 17 * k, r = 12.5 * k
  const circ = Math.round(2 * Math.PI * r)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r} stroke="var(--accent-light)" strokeWidth={2.8 * k}
        strokeDasharray={circ} strokeDashoffset={circ}
        style={{ animation: 'drawQ 1.2s ease forwards' }} />
      <line x1={22*k} y1={22*k} x2={33*k} y2={33*k}
        stroke="var(--accent-light)" strokeWidth={3.2 * k} strokeLinecap="round"
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
  const [user, setUser] = useState(null)
  const [authState, setAuthState] = useState('splash') // 'splash' | 'ready' | 'authed' | 'denied'
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('add')
  const [tabAnimKey, setTabAnimKey] = useState(0)
  const [tabSlideDir, setTabSlideDir] = useState('left')
  const [showAdd, setShowAdd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [invEnabled, setInvEnabled] = useState(() => localStorage.getItem('gastos_inv_enabled') !== 'false')
  const [categories, setCategories] = useState(loadCats)
  const [demoMode, setDemoMode] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('gastos_theme')
    return saved !== null ? saved === 'dark' : true
  })
  const [pinkMode, setPinkMode] = useState(false)

  useEffect(() => { applyTheme(darkMode, pinkMode) }, [darkMode, pinkMode])

  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('gastos_theme', next ? 'dark' : 'light')
  }

  const applyUserTheme = useCallback((email, dark) => {
    const pink = email === PINK_EMAIL
    setPinkMode(pink)
    applyTheme(dark ?? darkMode, pink)
  }, [darkMode])

  const fetchTransactions = useCallback(async (uid) => {
    if (!uid) return
    setLoading(true)
    try {
      // Apply recurring expenses before loading transactions
      await applyRecurrents(uid)
      const txs = await getTransactions(uid)
      setTransactions(txs.reverse())
      // Load categories from Firestore; migrate from localStorage if empty
      const savedCats = await getCategories(uid)
      if (savedCats) {
        setCategories(savedCats)
        localStorage.removeItem('gastos_cats')
        localStorage.removeItem('gastos_cats_v')
      } else {
        // First time: push localStorage cats to Firestore
        const localCats = loadCats()
        await saveCategories(uid, localCats)
        setCategories(localCats)
        localStorage.removeItem('gastos_cats')
        localStorage.removeItem('gastos_cats_v')
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setAuthState(prev => prev === 'splash' ? 'ready' : prev)
    }, 1800)

    const unsub = onAuthChanged(async (fbUser) => {
      if (!fbUser) {
        setUser(null)
        setAuthState(prev => prev === 'authed' || prev === 'denied' ? 'ready' : prev)
        return
      }
      clearTimeout(splashTimer)
      if (!isAllowedEmail(fbUser.email)) {
        await signOut()
        setUser(null)
        setAuthState('denied')
        return
      }
      setUser(fbUser)
      setAuthState('authed')
      applyUserTheme(fbUser.email)
      fetchTransactions(fbUser.uid)
    })

    return () => { clearTimeout(splashTimer); unsub() }
  }, [])

  const handleDemo = () => {
    setDemoMode(true)
    setTransactions([...DEMO_TRANSACTIONS].reverse())
    setCategories(DEMO_CATEGORIES)
    setAuthState('authed')
  }

  const handleSignIn = async () => {
    try { await signIn() }
    catch (e) { console.error(e) }
  }

  const handleSignOut = () => {
    setPinkMode(false)
    if (demoMode) { setDemoMode(false); setAuthState('ready'); setTransactions([]); return }
    signOut(); setUser(null); setAuthState('ready'); setTransactions([])
  }
  const handleSaveCats = (cats) => {
    setCategories(cats)
    saveCategories(user.uid, cats).catch(console.error)
  }
  const TABS = invEnabled ? ALL_TABS : ALL_TABS.filter(t => t !== 'inv')

  const toggleInvEnabled = (val) => {
    setInvEnabled(val)
    localStorage.setItem('gastos_inv_enabled', val ? 'true' : 'false')
    if (!val && tab === 'inv') setTab('add')
  }

  const mainSwipeX = useRef(null)
  const goTab = (newTab, dir) => { startTransition(() => { setTabSlideDir(dir); setTabAnimKey(k => k + 1); setTab(newTab) }) }
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

  if (authState === 'authed') {
    return (
      <div className="app">
        <header className="app-header">
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text1)', cursor: 'pointer', padding: 0 }} onClick={() => setTab('add')}>
            <Logo size={42} />
            <span className="header-title" style={{ fontSize: 26, letterSpacing: '-0.5px' }}>FinQuim</span>
            {demoMode && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 6px', letterSpacing: '.05em' }}>DEMO</span>}
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" onClick={toggleTheme} title="Canviar tema">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-icon" onClick={() => setShowSettings(true)} title="Configuració"><Settings size={18} /></button>
            <button className="btn-icon" onClick={handleSignOut} title="Sortir"><LogOut size={18} /></button>
          </div>
        </header>

        <main className="app-main" onTouchStart={onMainTouchStart} onTouchEnd={onMainTouchEnd}>
          <div key={tabAnimKey} className={`page-slide page-slide-${tabSlideDir}`}>
            {tab === 'add' && (
              <AddTransaction
                spreadsheetId={demoMode ? null : user?.uid}
                onAdded={onTransactionAdded}
                categories={categories}
                transactions={transactions}
                readOnly={demoMode}
                inline
              />
            )}
            {tab === 'inicio' && <Dashboard transactions={transactions} loading={loading} onRefresh={demoMode ? () => {} : () => fetchTransactions(user?.uid)} categories={categories} spreadsheetId={demoMode ? null : user?.uid} onDeleted={demoMode ? () => {} : onTransactionDeleted} onUpdated={demoMode ? () => {} : onTransactionUpdated} readOnly={demoMode} />}
            {tab === 'lista' && <TransactionList transactions={transactions} spreadsheetId={demoMode ? null : user?.uid} onDeleted={demoMode ? () => {} : onTransactionDeleted} onUpdated={demoMode ? () => {} : onTransactionUpdated} loading={loading} categories={categories} readOnly={demoMode} demoRecurrents={demoMode ? DEMO_RECURRENTS : null} />}
            {tab === 'stats' && <Stats transactions={transactions} />}
            {tab === 'inv' && invEnabled && <Inversions spreadsheetId={demoMode ? null : user?.uid} />}
          </div>
        </main>

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

        {showSettings && createPortal(
          <BottomSheet onClose={() => setShowSettings(false)}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Configuració</h2>

            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Pestanya Inversions</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Mostra la gestió de fons d'inversió</div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 26, flexShrink: 0 }}>
                <input type="checkbox" checked={invEnabled} onChange={e => toggleInvEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 26, cursor: 'pointer', transition: '.2s',
                  background: invEnabled ? 'var(--accent)' : 'var(--border)',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: invEnabled ? 21 : 3, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: '.2s',
                  }} />
                </span>
              </label>
            </div>

            <div className="stats-title" style={{ marginTop: 24 }}>Categories</div>
            <Categories
              categories={categories}
              onSave={demoMode ? () => {} : handleSaveCats}
              transactions={transactions}
              spreadsheetId={demoMode ? null : user?.uid}
              onReassigned={demoMode ? () => {} : onCategoryReassigned}
              readOnly={demoMode}
            />
          </BottomSheet>,
          document.body
        )}
      </div>
    )
  }

  // Splash + login screen
  return (
    <div className="splash-screen">
      <button onClick={handleDemo}
        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text2)', padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>
        Demo
      </button>
      <div className={`splash-content ${authState === 'ready' ? 'splash-ready' : ''}`}>
        <div className="splash-logo">
          <SplashLogo size={120} />
        </div>
        <div className="splash-brand">
          <div className="splash-name">FinQuim</div>
          <div className="splash-sub">Control de Despeses</div>
        </div>

        {authState === 'denied' && (
          <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginBottom: 12, maxWidth: 260 }}>
            Aquest compte de Google no té accés a l'app.
          </div>
        )}

        <div className={`splash-actions ${authState === 'ready' || authState === 'denied' ? 'splash-actions-visible' : ''}`}>
          <button className="btn-primary btn-large splash-btn" onClick={handleSignIn}>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
              <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connectar amb Google
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
