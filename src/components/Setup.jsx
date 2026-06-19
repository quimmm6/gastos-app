import { useState } from 'react'

export default function Setup({ onSave }) {
  const [form, setForm] = useState({ clientId: '', apiKey: '', spreadsheetId: '' })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.trim() }))
  const valid = form.clientId && form.apiKey && form.spreadsheetId

  return (
    <div className="setup-screen">
      <h1>⚙️ Configuración inicial</h1>
      <p className="sub">Solo necesitas hacer esto una vez. Los datos se guardan en tu dispositivo.</p>

      <div className="step-block">
        <div className="step-num">Paso 1 — Google Cloud Console</div>
        <div className="step-text">
          Ve a <strong>console.cloud.google.com</strong> → Crea un proyecto → Activa la
          API <code>Google Sheets API</code>.
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Paso 2 — Credenciales OAuth</div>
        <div className="step-text">
          En <em>APIs y servicios → Credenciales</em>, crea un <strong>ID de cliente OAuth 2.0</strong> de tipo
          <em> Aplicación web</em>. En <em>Orígenes autorizados</em> añade la URL de tu GitHub Pages
          (p.ej. <code>https://tuusuario.github.io</code>).
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Paso 3 — API Key</div>
        <div className="step-text">
          En <em>Credenciales</em>, crea también una <strong>Clave de API</strong>. Restrígela a
          la <em>Google Sheets API</em>.
        </div>
      </div>

      <div className="step-block">
        <div className="step-num">Paso 4 — Google Sheets</div>
        <div className="step-text">
          Crea una hoja de cálculo nueva en <strong>sheets.google.com</strong>.
          El ID está en la URL: <code>docs.google.com/spreadsheets/d/<strong>ESTE_ES_EL_ID</strong>/edit</code>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label>Client ID de OAuth</label>
          <input placeholder="xxxxx.apps.googleusercontent.com" onChange={set('clientId')} value={form.clientId} />
        </div>
        <div className="form-group">
          <label>API Key</label>
          <input placeholder="AIzaSy..." onChange={set('apiKey')} value={form.apiKey} />
        </div>
        <div className="form-group">
          <label>Spreadsheet ID</label>
          <input placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" onChange={set('spreadsheetId')} value={form.spreadsheetId} />
        </div>
        <button className="btn-primary" disabled={!valid} onClick={() => onSave(form)}>
          Guardar y continuar →
        </button>
      </div>
    </div>
  )
}
