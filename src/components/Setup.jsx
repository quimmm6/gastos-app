import { useState } from 'react'
import Logo from './Logo'

export default function Setup({ onSave }) {
  const [form, setForm] = useState({ clientId: '', apiKey: '', spreadsheetId: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.trim() }))
  const valid = form.clientId && form.apiKey && form.spreadsheetId

  return (
    <div className="setup-screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Logo size={36} />
        <h1>Configuració inicial</h1>
      </div>
      <p className="sub">Només has de fer-ho una vegada. Les dades es guarden al teu dispositiu.</p>

      <div className="step-block">
        <div className="step-num">Pas 1 — Google Cloud Console</div>
        <div className="step-text">
          Ves a <strong>console.cloud.google.com</strong> → Crea un projecte → Activa la
          API <code>Google Sheets API</code>.
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Pas 2 — Credencials OAuth</div>
        <div className="step-text">
          A <em>APIs i serveis → Credencials</em>, crea un <strong>ID de client OAuth 2.0</strong> de tipus
          <em> Aplicació web</em>. A <em>Orígens autoritzats</em> afegeix la URL de GitHub Pages.
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Pas 3 — Clau d'API</div>
        <div className="step-text">
          A <em>Credencials</em>, crea també una <strong>Clau d'API</strong>. Restringeix-la a
          la <em>Google Sheets API</em>.
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Pas 4 — Google Sheets</div>
        <div className="step-text">
          Crea un full de càlcul nou a <strong>sheets.google.com</strong>.
          L'ID és a la URL: <code>docs.google.com/spreadsheets/d/<strong>AQUEST_ÉS_L_ID</strong>/edit</code>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label>Client ID d'OAuth</label>
          <input placeholder="xxxxx.apps.googleusercontent.com" onChange={set('clientId')} value={form.clientId} />
        </div>
        <div className="form-group">
          <label>Clau d'API</label>
          <input placeholder="AIzaSy..." onChange={set('apiKey')} value={form.apiKey} />
        </div>
        <div className="form-group">
          <label>Spreadsheet ID</label>
          <input placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" onChange={set('spreadsheetId')} value={form.spreadsheetId} />
        </div>
        <button className="btn-primary" disabled={!valid} onClick={() => onSave(form)}>
          Desar i continuar →
        </button>
      </div>
    </div>
  )
}
