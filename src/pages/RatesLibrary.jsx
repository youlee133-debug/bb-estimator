import { useState, useEffect } from 'react'
import { getRates, saveRate, deleteRate, TRADES, UNITS } from '../lib/store'

const EMPTY = { trade_id: '', description: '', unit: 'no', default_rate: '', markup_pct: 20, cost_code: '' }

export default function RatesLibrary() {
  const [rates, setRates] = useState([])
  const [filterTrade, setFilterTrade] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)

  const reload = () => setRates(getRates())
  useEffect(() => { reload() }, [])

  const filtered = filterTrade ? rates.filter(r => r.trade_id === filterTrade) : rates

  const handleSave = () => {
    if (!form.description || !form.trade_id) return
    saveRate({
      ...(editing ? { id: editing } : {}),
      ...form,
      default_rate: parseFloat(form.default_rate) || 0,
      markup_pct: parseFloat(form.markup_pct) / 100,
    })
    reload()
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY)
  }

  const handleEdit = (r) => {
    setForm({ ...r, markup_pct: Math.round((r.markup_pct || 0.20) * 100) })
    setEditing(r.id)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Remove this rate from the library?')) { deleteRate(id); reload() }
  }

  const tradeName = (id) => TRADES.find(t => t.id === id)?.name || id

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rates library</h1>
          <p className="page-sub">{rates.length} items across {TRADES.length} trades</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}>+ Add rate</button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={filterTrade} onChange={e => setFilterTrade(e.target.value)}>
          <option value="">All trades</option>
          {TRADES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="filter-count">{filtered.length} items</span>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{editing ? 'Edit rate' : 'Add rate'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Trade *</span>
                <select value={form.trade_id} onChange={e => setForm({ ...form, trade_id: e.target.value })}>
                  <option value="">Select trade</option>
                  {TRADES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Cost code</span>
                <input value={form.cost_code} onChange={e => setForm({ ...form, cost_code: e.target.value })} placeholder="e.g. 302" />
              </label>
              <label className="field full">
                <span>Description *</span>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Item description" />
              </label>
              <label className="field">
                <span>Unit</span>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Default rate ($)</span>
                <input type="number" value={form.default_rate} onChange={e => setForm({ ...form, default_rate: e.target.value })} placeholder="0" />
              </label>
              <label className="field">
                <span>Default markup (%)</span>
                <input type="number" value={form.markup_pct} onChange={e => setForm({ ...form, markup_pct: e.target.value })} placeholder="20" />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save rate</button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <p>No rates yet. Add items manually or import from your spreadsheet.</p>
        </div>
      ) : (
        <div className="rates-table-wrap">
          <table className="rates-table">
            <thead>
              <tr>
                <th>Trade</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Default rate</th>
                <th>Markup</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="rate-row">
                  <td><span className="trade-badge">{tradeName(r.trade_id)}</span></td>
                  <td className="rate-desc">{r.description}</td>
                  <td className="rate-unit">{r.unit}</td>
                  <td className="rate-val">${(r.default_rate || 0).toLocaleString()}</td>
                  <td className="rate-val">{Math.round((r.markup_pct || 0.20) * 100)}%</td>
                  <td className="rate-actions">
                    <button className="action-btn" onClick={() => handleEdit(r)}>Edit</button>
                    <button className="action-btn danger" onClick={() => handleDelete(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
