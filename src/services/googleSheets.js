const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'
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

export async function initSheet(spreadsheetId) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A1:F1',
  })
  if (!res.result.values) {
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1:F1',
      valueInputOption: 'RAW',
      resource: { values: [['fecha', 'importe', 'tipo', 'categoria', 'descripcion', 'id']] },
    })
  }
}

export async function getTransactions(spreadsheetId) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A2:F',
  })
  const rows = res.result.values || []
  return rows.map((r) => ({
    fecha: r[0] || '',
    importe: parseFloat(r[1]) || 0,
    tipo: r[2] || 'gasto',
    categoria: r[3] || '',
    descripcion: r[4] || '',
    id: r[5] || '',
  }))
}

export async function addTransaction(spreadsheetId, tx) {
  const id = Date.now().toString()
  await window.gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'A:F',
    valueInputOption: 'RAW',
    resource: {
      values: [[tx.fecha, tx.importe, tx.tipo, tx.categoria, tx.descripcion, id]],
    },
  })
  return { ...tx, id }
}

export async function deleteTransaction(spreadsheetId, id) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'F:F',
  })
  const rows = res.result.values || []
  const rowIndex = rows.findIndex((r) => r[0] === id)
  if (rowIndex < 1) return

  const meta = await window.gapi.client.sheets.spreadsheets.get({ spreadsheetId })
  const sheetId = meta.result.sheets[0].properties.sheetId

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
    range: 'F:F',
  })
  const rows = res.result.values || []
  const rowIndex = rows.findIndex(r => r[0] === tx.id)
  if (rowIndex < 1) return

  await window.gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `A${rowIndex + 1}:F${rowIndex + 1}`,
    valueInputOption: 'RAW',
    resource: { values: [[tx.fecha, tx.importe, tx.tipo, tx.categoria, tx.descripcion, tx.id]] },
  })
}

export async function reassignCategory(spreadsheetId, oldCat, newCat) {
  const res = await window.gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A2:F',
  })
  const rows = res.result.values || []
  const updates = []
  rows.forEach((row, i) => {
    if (row[3] === oldCat) {
      updates.push({ range: `D${i + 2}`, values: [[newCat]] })
    }
  })
  if (updates.length === 0) return 0
  await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'RAW', data: updates },
  })
  return updates.length
}
