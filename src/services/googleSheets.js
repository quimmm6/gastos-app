function parseNum(val) { return parseFloat(String(val).replace(',', '.')) || 0 }

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'
const REG_SHEET = 'Registre'
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4'

let gapiInited = false
let gisInited = false
let tokenClient = null

export function loadGoogleAPIs(clientId, apiKey) {
  return new Promise((resolve) => {
    const gapiScript = document.createElement('script')
    gapiScript.src = 'https://apis.google.com/js/api.js'
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] })
        gapiInited = true
        if (gisInited) resolve()
      })
    }
    document.head.appendChild(gapiScript)

    const gisScript = document.createElement('script')
    gisScript.src = 'https://accounts.google.com/gsi/client'
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '',
      })
      gisInited = true
      if (gapiInited) resolve()
    }
    document.head.appendChild(gisScript)
  })
}

export function signIn(prompt = '') {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) reject(resp)
      else resolve(resp)
    }
    tokenClient.requestAccessToken({ prompt })
  })
}

export function signOut() {
  const token = window.gapi.client.getToken()
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken('')
  }
}

export function isSignedIn() {
  return !!window.gapi?.client?.getToken()
}

const TIPO_TO_CAT = { 'gasto': 'Despesa', 'ingreso': 'Ingrés' }
const CAT_TO_TIPO = { 'Despesa': 'gasto', 'Ingrés': 'ingreso', 'gasto': 'gasto', 'ingreso': 'ingreso' }

export async function initSheet(spreadsheetId) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REG_SHEET}!A1:F1`,
  })
  if (!res.result.values) {
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${REG_SHEET}!A1:F1`,
      valueInputOption: 'RAW',
      resource: { values: [['Data', 'Import', 'Tipus', 'Categoria', 'Descripció', 'ID']] },
    })
  }
}

export async function getTransactions(spreadsheetId) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REG_SHEET}!A2:G`,
  })
  const rows = res.result.values || []
  return rows.map((r) => ({
    fecha: r[0] || '',
    importe: parseNum(r[1]),
    tipo: CAT_TO_TIPO[r[2]] || 'gasto',
    categoria: r[3] || '',
    descripcion: r[4] || '',
    id: r[5] || '',
    actiu: (r[6] ?? 'TRUE').toString().toUpperCase() !== 'FALSE',
  }))
}

export async function addTransaction(spreadsheetId, tx) {
  const id = Date.now().toString()
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${REG_SHEET}!A:G`,
    valueInputOption: 'RAW',
    resource: {
      values: [[tx.fecha, tx.importe, TIPO_TO_CAT[tx.tipo] || tx.tipo, tx.categoria, tx.descripcion, id, 'TRUE']],
    },
  })
  return { ...tx, id, actiu: true }
}

export async function deleteTransaction(spreadsheetId, id) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REG_SHEET}!F:F`,
  })
  const rows = res.result.values || []
  const rowIndex = rows.findIndex((r) => r[0] === id)
  if (rowIndex < 1) return

  const meta = await window.gapi.client.sheets.spreadsheets.get({ spreadsheetId })
  const sheet = meta.result.sheets.find(s => s.properties.title === REG_SHEET)
  const sheetId = sheet?.properties.sheetId ?? meta.result.sheets[0].properties.sheetId

  await window.gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    },
  })
}

export async function updateTransaction(spreadsheetId, tx) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REG_SHEET}!F:F`,
  })
  const rows = res.result.values || []
  const rowIndex = rows.findIndex(r => r[0] === tx.id)
  if (rowIndex < 1) return

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${REG_SHEET}!A${rowIndex + 1}:G${rowIndex + 1}`,
    valueInputOption: 'RAW',
    resource: { values: [[tx.fecha, tx.importe, TIPO_TO_CAT[tx.tipo] || tx.tipo, tx.categoria, tx.descripcion, tx.id, tx.actiu === false ? 'FALSE' : 'TRUE']] },
  })
}

const CATS_SHEET = 'Categories'

export async function getCategories(spreadsheetId) {
  try {
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${CATS_SHEET}!A1:C`,
    })
    const rows = res.result.values || []
    if (rows.length === 0) return null
    const cats = { gasto: [], ingreso: [] }
    rows.forEach(r => {
      const tipo = CAT_TO_TIPO[r[0]], name = r[1], icon = r[2] || '📦'
      if (tipo === 'gasto' || tipo === 'ingreso') cats[tipo].push({ name, icon })
    })
    return cats
  } catch {
    return null
  }
}

export async function saveCategories(spreadsheetId, cats) {
  const rows = [
    ...cats.gasto.map(c => ['Despesa', c.name, c.icon]),
    ...cats.ingreso.map(c => ['Ingrés', c.name, c.icon]),
  ]
  // Ensure the Categories sheet exists
  try {
    const meta = await window.gapi.client.sheets.spreadsheets.get({ spreadsheetId })
    const exists = meta.result.sheets.some(s => s.properties.title === CATS_SHEET)
    if (!exists) {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: CATS_SHEET } } }] },
      })
    }
  } catch {}
  // Clear and rewrite
  await window.gapi.client.sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${CATS_SHEET}!A:C`,
  })
  if (rows.length > 0) {
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${CATS_SHEET}!A1`,
      valueInputOption: 'RAW',
      resource: { values: rows },
    })
  }
}

const REC_SHEET = 'Recurrents'

function daysInMonth(y, m) { return new Date(y, m, 0).getDate() }

function resolveDay(dia, y, m) {
  const raw = String(dia).toUpperCase().trim()
  if (raw === 'P') return 1
  if (raw === 'U') return daysInMonth(y, m)
  const n = parseInt(raw)
  return Math.min(n, daysInMonth(y, m))
}

export async function applyRecurrents(spreadsheetId) {
  try {
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${REC_SHEET}!A2:G`,
    })
    const rows = res.result.values || []
    if (rows.length === 0) return []

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()

    const txRes = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${REG_SHEET}!A2:F`,
    })
    const existingRows = txRes.result.values || []

    const added = []
    for (const r of rows) {
      const diaRaw = (r[0] || '').toString().trim()
      const inici = r[1] || ''
      const importe = parseNum(r[2])
      const tipusRaw = (r[3] || 'Despesa').trim()
      const categoria = r[4] || ''
      const descripcion = r[5] || ''
      const activa = (r[6] || '').toString().toUpperCase()

      if (!diaRaw || !importe || !categoria) continue

      const iniciParts = inici.split('-')
      const iniciYear = parseInt(iniciParts[0])
      const iniciMonth = parseInt(iniciParts[1])
      if (!iniciYear || !iniciMonth) continue

      const tipo = CAT_TO_TIPO[tipusRaw] || 'gasto'
      const tipusSheet = TIPO_TO_CAT[tipo] || 'Despesa'

      const monthsToCheck = []
      let y = iniciYear, m = iniciMonth
      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        const realDay = resolveDay(diaRaw, y, m)
        const isPast = y < currentYear || m < currentMonth
        const isCurrent = y === currentYear && m === currentMonth
        if (isPast || (isCurrent && currentDay >= realDay)) {
          monthsToCheck.push({ ym: `${y}-${String(m).padStart(2, '0')}`, realDay })
        }
        m++; if (m > 12) { m = 1; y++ }
      }

      for (const { ym, realDay } of monthsToCheck) {
        const fecha = `${ym}-${String(realDay).padStart(2, '0')}`
        const alreadyExists = existingRows.some(er =>
          er[3] === categoria && (er[0] || '').startsWith(ym) && (er[4] || '') === descripcion
        )
        if (alreadyExists) continue

        const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const actiu = !(activa === 'FALSE' || activa === 'NO')
        await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${REG_SHEET}!A:G`,
          valueInputOption: 'RAW',
          resource: { values: [[fecha, importe, tipusSheet, categoria, descripcion, id, actiu ? 'TRUE' : 'FALSE']] },
        })
        added.push({ fecha, importe, tipo, categoria, descripcion, id, actiu })
      }
    }
    return added
  } catch (e) {
    console.error('applyRecurrents error', e)
    return []
  }
}

export async function reassignCategory(spreadsheetId, oldCat, newCat) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${REG_SHEET}!A2:F`,
  })
  const rows = res.result.values || []
  const updates = []
  rows.forEach((row, i) => {
    if (row[3] === oldCat) {
      updates.push({ range: `${REG_SHEET}!D${i + 2}`, values: [[newCat]] })
    }
  })
  if (updates.length === 0) return 0
  await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'RAW', data: updates },
  })
  return updates.length
}

export async function getRecurrents(spreadsheetId) {
  try {
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${REC_SHEET}!A2:G`,
    })
    const rows = res.result.values || []
    return rows.map((r, i) => ({
      rowIndex: i + 2,
      dia: (r[0] || '1').toString().trim(),
      inici: r[1] || '',
      importe: parseNum(r[2]) || 0,
      tipo: CAT_TO_TIPO[(r[3] || 'Despesa').trim()] || 'gasto',
      categoria: r[4] || '',
      descripcion: r[5] || '',
      activa: (r[6] || 'TRUE').toString().toUpperCase() !== 'FALSE',
    }))
  } catch { return [] }
}

export async function updateRecurrent(spreadsheetId, rec) {
  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${REC_SHEET}!A${rec.rowIndex}:G${rec.rowIndex}`,
    valueInputOption: 'RAW',
    resource: { values: [[rec.dia, rec.inici, rec.importe, TIPO_TO_CAT[rec.tipo] || 'Despesa', rec.categoria, rec.descripcion, rec.activa ? 'TRUE' : 'FALSE']] },
  })
}

export async function deleteRecurrent(spreadsheetId, rowIndex) {
  const meta = await window.gapi.client.sheets.spreadsheets.get({ spreadsheetId })
  const sheet = meta.result.sheets.find(s => s.properties.title === REC_SHEET)
  if (!sheet) return
  await window.gapi.client.sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [{ deleteDimension: {
        range: { sheetId: sheet.properties.sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
      }}],
    },
  })
}

export async function addRecurrent(spreadsheetId, rec) {
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${REC_SHEET}!A:G`,
    valueInputOption: 'RAW',
    resource: { values: [[rec.dia, rec.inici, rec.importe, TIPO_TO_CAT[rec.tipo] || 'Despesa', rec.categoria, rec.descripcion, 'TRUE']] },
  })
}
