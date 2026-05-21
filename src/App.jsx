import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import RatesLibrary from './pages/RatesLibrary'
import SubcontractorDB from './pages/SubcontractorDB'
import AITakeoff from './pages/AITakeoff'
import './index.css'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [activeProject, setActiveProject] = useState(null)
  const [navCount, setNavCount] = useState(0)

  const navigate = (target, project = null) => {
    setPage(target)
    setNavCount(c => c + 1)
    if (project) setActiveProject(project)
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} navigate={navigate} />
      <main className="main-content">
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'project' && <ProjectView project={activeProject} navigate={navigate} />}
        {page === 'rates' && <RatesLibrary />}
        {page === 'subcontractors' && <SubcontractorDB />}
        {page === 'takeoff' && <AITakeoff key={navCount} navigate={navigate} />}
      </main>
    </div>
  )
}

function Sidebar({ page, navigate }) {
  const links = [
    { id: 'dashboard', label: 'Projects', icon: '⬡' },
    { id: 'takeoff', label: 'AI Takeoff', icon: '◎' },
    { id: 'rates', label: 'Rates Library', icon: '◈' },
    { id: 'subcontractors', label: 'Subcontractors', icon: '◉' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">BB</span>
        <span className="brand-name">Estimator</span>
      </div>
      <nav className="sidebar-nav">
        {links.map(l => (
          <button
            key={l.id}
            className={`nav-item ${page === l.id || (page === 'project' && l.id === 'dashboard') ? 'active' : ''}`}
            onClick={() => navigate(l.id)}
          >
            <span className="nav-icon">{l.icon}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="version-tag">Phase 3 · v0.1</div>
      </div>
    </aside>
  )
}