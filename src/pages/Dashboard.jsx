import { useState, useEffect } from 'react'
import { getProjects, createProject, deleteProject, calcProjectSummary, fmt } from '../lib/store'

export default function Dashboard({ navigate }) {
  const [projects, setProjects] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', client: '', address: '', tenancy_m2: '', start_date: '' })

  useEffect(() => { setProjects(getProjects()) }, [showNew])

  const handleCreate = () => {
    if (!form.name || !form.client) return
    const p = createProject(form)
    setProjects(getProjects())
    setShowNew(false)
    setForm({ name: '', client: '', address: '', tenancy_m2: '', start_date: '' })
    navigate('project', p)
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this project and all its data?')) {
      deleteProject(id)
      setProjects(getProjects())
    }
  }

  const summaries = {}
  projects.forEach(p => { summaries[p.id] = calcProjectSummary(p.id, p.margin_pct) })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">{projects.length} active estimate{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ New project</button>
      </div>

      {showNew && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>New project</h2>
              <button className="close-btn" onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Project name *</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. BP26 — Retail Fitout" />
              </label>
              <label className="field">
                <span>Client *</span>
                <input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Client company name" />
              </label>
              <label className="field full">
                <span>Site address</span>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Shop address" />
              </label>
              <label className="field">
                <span>Tenancy m²</span>
                <input type="number" value={form.tenancy_m2} onChange={e => setForm({ ...form, tenancy_m2: e.target.value })} placeholder="0" />
              </label>
              <label className="field">
                <span>Start date</span>
                <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate}>Create project</button>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <p>No projects yet. Create your first estimate.</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(p => {
            const s = summaries[p.id]
            const costPerM2 = p.tenancy_m2 > 0 ? s.total / p.tenancy_m2 : 0
            return (
              <div key={p.id} className="project-card" onClick={() => navigate('project', p)}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{p.name}</div>
                    <div className="card-client">{p.client}</div>
                  </div>
                  <button className="delete-btn" onClick={e => handleDelete(e, p.id)}>✕</button>
                </div>
                <div className="card-address">{p.address}</div>
                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-label">Total (inc. GST)</span>
                    <span className="stat-value">{fmt(s.total)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Trade cost</span>
                    <span className="stat-value">{fmt(s.tradeCost)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Cost / m²</span>
                    <span className="stat-value">{costPerM2 > 0 ? fmt(costPerM2) : '—'}</span>
                  </div>
                </div>
                <div className="card-footer">
                  <span className={`status-pill ${p.status}`}>{p.status}</span>
                  {p.start_date && <span className="card-date">{new Date(p.start_date).toLocaleDateString('en-AU')}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
