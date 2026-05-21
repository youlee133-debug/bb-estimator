import { useState, useEffect } from 'react'
import { getSubcontractors, saveSubcontractor, deleteSubcontractor, TRADES } from '../lib/store'

const EMPTY = { company_name: '', contact_name: '', email: '', phone: '', trade_ids: [], status: 'active' }

export default function SubcontractorDB() {
  const [subs, setSubs] = useState([])
  const [filterTrade, setFilterTrade] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const reload = () => setSubs(getSubcontractors())
  useEffect(() => { reload() }, [])

  const filtered = subs.filter(s => {
    if (filterTrade && !s.trade_ids?.includes(filterTrade)) return false
    if (filterStatus && s.status !== filterStatus) return false
    return true
  })

  const toggleTrade = (tid) => {
    const ids = form.trade_ids || []
    setForm({ ...form, trade_ids: ids.includes(tid) ? ids.filter(i => i !== tid) : [...ids, tid] })
  }

  const handleSave = () => {
    if (!form.company_name) return
    saveSubcontractor({ ...(editing ? { id: editing } : {}), ...form })
    reload()
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY)
  }

  const handleEdit = (s) => {
    setForm({ ...s })
    setEditing(s.id)
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Remove this subcontractor?')) { deleteSubcontractor(id); reload() }
  }

  const tradeNames = (ids) => (ids || []).map(id => TRADES.find(t => t.id === id)?.name).filter(Boolean).join(', ') || '—'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subcontractors</h1>
          <p className="page-sub">{subs.length} in database</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}>+ Add subcontractor</button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={filterTrade} onChange={e => setFilterTrade(e.target.value)}>
          <option value="">All trades</option>
          {TRADES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="preferred">Preferred</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        <span className="filter-count">{filtered.length} shown</span>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal modal-wide">
            <div className="modal-header">
              <h2>{editing ? 'Edit subcontractor' : 'Add subcontractor'}</h2>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="form-grid">
              <label className="field full">
                <span>Company name *</span>
                <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="Company Pty Ltd" />
              </label>
              <label className="field">
                <span>Contact name</span>
                <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="First Last" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@company.com.au" />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="04xx xxx xxx" />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="preferred">Preferred</option>
                  <option value="blacklisted">Blacklisted</option>
                </select>
              </label>
              <div className="field full">
                <span className="field-label">Trades</span>
                <div className="trade-checkboxes">
                  {TRADES.map(t => (
                    <label key={t.id} className="trade-check">
                      <input
                        type="checkbox"
                        checked={(form.trade_ids || []).includes(t.id)}
                        onChange={() => toggleTrade(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◉</div>
          <p>No subcontractors yet. Build your database.</p>
        </div>
      ) : (
        <div className="sub-table-wrap">
          <table className="rates-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Trades</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="rate-row">
                  <td className="rate-desc">{s.company_name}</td>
                  <td>{s.contact_name || '—'}</td>
                  <td className="email-cell">{s.email || '—'}</td>
                  <td className="trades-cell">{tradeNames(s.trade_ids)}</td>
                  <td><span className={`status-pill ${s.status}`}>{s.status}</span></td>
                  <td className="rate-actions">
                    <button className="action-btn" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="action-btn danger" onClick={() => handleDelete(s.id)}>Delete</button>
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
