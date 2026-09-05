import { initializeApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore, doc, collection, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyABSBC1c-tqVUZqx8fi6ArjejGmZgZ9dbk',
  authDomain: 'finquim-2026.firebaseapp.com',
  projectId: 'finquim-2026',
  storageBucket: 'finquim-2026.firebasestorage.app',
  messagingSenderId: '156499129307',
  appId: '1:156499129307:web:1efa66d58fad9bb631adfe',
}

// Emails autoritzats — afegeix o treu els que calgui
const ALLOWED_EMAILS = [
  'quimjuanola6@gmail.com',
  'claravalenti07@gmail.com',
]

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// ── Auth ──────────────────────────────────────────────────────────────────────

const provider = new GoogleAuthProvider()

export function signIn() {
  return signInWithPopup(auth, provider)
}

export function signOut() {
  return fbSignOut(auth)
}

export function onAuthChanged(cb) {
  return onAuthStateChanged(auth, cb)
}

export function getCurrentUser() {
  return auth.currentUser
}

export function getUserEmail() {
  return auth.currentUser?.email ?? null
}

export function isAllowedEmail(email) {
  return ALLOWED_EMAILS.includes(email)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function userCol(uid, col) {
  return collection(db, 'users', uid, col)
}

function userDoc(uid, col, id) {
  return doc(db, 'users', uid, col, id)
}

function parseNum(val) { return parseFloat(String(val ?? 0).replace(',', '.')) || 0 }

// ── Transactions ──────────────────────────────────────────────────────────────

export async function getTransactions(uid) {
  const snap = await getDocs(userCol(uid, 'transactions'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addTransaction(uid, tx) {
  const id = Date.now().toString()
  await setDoc(userDoc(uid, 'transactions', id), { ...tx, actiu: true })
  return { ...tx, id, actiu: true }
}

export async function updateTransaction(uid, tx) {
  const { id, ...data } = tx
  await updateDoc(userDoc(uid, 'transactions', id), data)
}

export async function deleteTransaction(uid, id) {
  await deleteDoc(userDoc(uid, 'transactions', id))
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(uid) {
  const snap = await getDoc(userDoc(uid, 'config', 'categories'))
  if (!snap.exists()) return null
  return snap.data()
}

export async function saveCategories(uid, cats) {
  await setDoc(userDoc(uid, 'config', 'categories'), cats)
}

// ── Recurrents ────────────────────────────────────────────────────────────────

function daysInMonth(y, m) { return new Date(y, m, 0).getDate() }

function resolveDay(dia, y, m) {
  const raw = String(dia).toUpperCase().trim()
  if (raw === 'P') return 1
  if (raw === 'U') return daysInMonth(y, m)
  return Math.min(parseInt(raw) || 1, daysInMonth(y, m))
}

export async function getRecurrents(uid) {
  const snap = await getDocs(userCol(uid, 'recurrents'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addRecurrent(uid, rec) {
  const ref = await addDoc(userCol(uid, 'recurrents'), rec)
  return { ...rec, id: ref.id }
}

export async function updateRecurrent(uid, rec) {
  const { id, ...data } = rec
  await updateDoc(userDoc(uid, 'recurrents', id), data)
}

export async function deleteRecurrent(uid, id) {
  await deleteDoc(userDoc(uid, 'recurrents', id))
}

export async function applyRecurrents(uid) {
  const recs = await getRecurrents(uid)
  if (!recs.length) return []

  const snap = await getDocs(userCol(uid, 'transactions'))
  const existingTxs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const now = new Date()
  const curYear = now.getFullYear(), curMonth = now.getMonth() + 1, curDay = now.getDate()
  const added = []
  const CAT_TO_TIPO = { 'Despesa': 'gasto', 'Ingrés': 'ingreso', 'gasto': 'gasto', 'ingreso': 'ingreso' }
  const TIPO_TO_CAT = { 'gasto': 'Despesa', 'ingreso': 'Ingrés' }

  for (const rec of recs.filter(r => r.activa !== false)) {
    const [iy, im] = (rec.inici || '').split('-').map(Number)
    if (!iy || !im) continue

    let y = iy, m = im
    while (y < curYear || (y === curYear && m <= curMonth)) {
      const realDay = resolveDay(rec.dia, y, m)
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const fecha = `${ym}-${String(realDay).padStart(2, '0')}`
      const isCurrent = y === curYear && m === curMonth
      const isDue = !isCurrent || curDay >= realDay

      if (isDue) {
        const alreadyExists = existingTxs.some(t =>
          t.categoria === rec.categoria && (t.fecha || '').startsWith(ym) && (t.descripcion || '') === (rec.descripcion || '')
        )
        if (!alreadyExists) {
          const tipo = CAT_TO_TIPO[rec.tipo] || 'gasto'
          const tx = { fecha, importe: rec.importe, tipo, categoria: rec.categoria, descripcion: rec.descripcion || '', actiu: rec.activa !== false }
          const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`
          await setDoc(userDoc(uid, 'transactions', id), tx)
          const entry = { ...tx, id }
          existingTxs.push(entry)
          added.push(entry)
        }
      }
      m++; if (m > 12) { m = 1; y++ }
    }
  }
  return added
}

export async function reassignCategory(uid, oldCat, newCat) {
  const snap = await getDocs(query(userCol(uid, 'transactions'), where('categoria', '==', oldCat)))
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { categoria: newCat }))
  await batch.commit()
  return snap.size
}

// ── Fons d'inversió ───────────────────────────────────────────────────────────

export async function getFunds(uid) {
  const snap = await getDocs(userCol(uid, 'funds'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addFund(uid, fund) {
  const ref = await addDoc(userCol(uid, 'funds'), fund)
  return { ...fund, id: ref.id }
}

export async function updateFund(uid, fund) {
  const { id, ...data } = fund
  await updateDoc(userDoc(uid, 'funds', id), data)
}

export async function deleteFund(uid, id) {
  await deleteDoc(userDoc(uid, 'funds', id))
}

// ── EntFons (aportacions) ─────────────────────────────────────────────────────

export async function getInvEntries(uid) {
  const snap = await getDocs(userCol(uid, 'invEntries'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addInvEntry(uid, entry) {
  const ref = await addDoc(userCol(uid, 'invEntries'), entry)
  return { ...entry, id: ref.id }
}

export async function updateInvEntry(uid, entry) {
  const { id, ...data } = entry
  await updateDoc(userDoc(uid, 'invEntries', id), data)
}

export async function deleteInvEntry(uid, id) {
  await deleteDoc(userDoc(uid, 'invEntries', id))
}

// ── ValFons (valoracions) ─────────────────────────────────────────────────────

export async function getInvValuations(uid) {
  const snap = await getDocs(userCol(uid, 'invValuations'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addInvValuation(uid, val) {
  const ref = await addDoc(userCol(uid, 'invValuations'), val)
  return { ...val, id: ref.id }
}

export async function updateInvValuation(uid, val) {
  const { id, ...data } = val
  await updateDoc(userDoc(uid, 'invValuations', id), data)
}

export async function deleteInvValuation(uid, id) {
  await deleteDoc(userDoc(uid, 'invValuations', id))
}

// ── RecFons (aportacions recurrents) ──────────────────────────────────────────

export async function getRecFunds(uid) {
  const snap = await getDocs(userCol(uid, 'recFunds'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addRecFund(uid, rec) {
  const ref = await addDoc(userCol(uid, 'recFunds'), rec)
  return { ...rec, id: ref.id }
}

export async function updateRecFund(uid, rec) {
  const { id, ...data } = rec
  await updateDoc(userDoc(uid, 'recFunds', id), data)
}

export async function deleteRecFund(uid, id) {
  await deleteDoc(userDoc(uid, 'recFunds', id))
}

export async function applyRecurringContributions(uid) {
  const [recs, existingEntries] = await Promise.all([
    getRecFunds(uid),
    getInvEntries(uid),
  ])
  if (!recs.length) return []

  const now = new Date()
  const curYear = now.getFullYear(), curMonth = now.getMonth() + 1, curDay = now.getDate()
  const added = []

  for (const rec of recs.filter(r => r.activa !== false)) {
    const [iy, im] = (rec.inici || '').split('-').map(Number)
    if (!iy || !im) continue
    let y = iy, m = im
    while (y < curYear || (y === curYear && m <= curMonth)) {
      const realDay = resolveDay(rec.dia, y, m)
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const fecha = `${ym}-${String(realDay).padStart(2, '0')}`
      const isCurrent = y === curYear && m === curMonth
      const isDue = !isCurrent || curDay >= realDay
      if (isDue) {
        const alreadyExists = existingEntries.some(e =>
          e.fundId === rec.fundId && (e.date || '').startsWith(ym) && e.amountAdded === rec.importe
        )
        if (!alreadyExists) {
          const entry = await addInvEntry(uid, { fundId: rec.fundId, date: fecha, amountAdded: rec.importe, currentValue: 0 })
          existingEntries.push(entry)
          added.push(entry)
        }
      }
      m++; if (m > 12) { m = 1; y++ }
    }
  }
  return added
}
