// lib/store.js — localStorage-backed data layer
// Replace with Supabase calls when ready to go live

const KEYS = {
  projects: 'bb_projects',
  estimates: 'bb_estimates',
  rates: 'bb_rates',
  subcontractors: 'bb_subcontractors',
}

const uid = () => crypto.randomUUID()

const load = (key, fallback = []) => {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

// ── TRADES ────────────────────────────────────────────────────────────────────
export const TRADES = [
  { id: 'prelims',    code: '320', name: 'Preliminaries' },
  { id: 'consultant', code: '317', name: 'Consultant' },
  { id: 'demo',       code: '305', name: 'Demolition' },
  { id: 'electrical', code: '302', name: 'Electrical Services' },
  { id: 'mechanical', code: '303', name: 'Mechanical Services' },
  { id: 'fire',       code: '304', name: 'Fire Extinguishers' },
  { id: 'hydraulics', code: '301', name: 'Plumbing Services' },
  { id: 'tiling',     code: '312', name: 'Tiling' },
  { id: 'glazing',    code: '308', name: 'Glazing' },
  { id: 'cp',         code: '306', name: 'Ceiling, Partitions, Timber Doors' },
  { id: 'joinery',    code: '307', name: 'Joinery' },
  { id: 'flooring',   code: '311', name: 'Flooring' },
  { id: 'painting',   code: '309', name: 'Painting' },
  { id: 'signage',    code: '310', name: 'Signage' },
  { id: 'stainless',  code: '316', name: 'Stainless' },
]

export const UNITS = ['m²', 'm', 'no', 'ea', 'hr', 'day', 'week', 'est', 'pct', 'men']

// ── PROJECTS ──────────────────────────────────────────────────────────────────
export const getProjects = () => load(KEYS.projects)

export const createProject = (data) => {
  const projects = getProjects()
  const project = {
    id: uid(),
    name: data.name,
    client: data.client,
    address: data.address,
    tenancy_m2: parseFloat(data.tenancy_m2) || 0,
    start_date: data.start_date || '',
    status: 'active',
    created_at: new Date().toISOString(),
    margin_pct: 0.20,
  }
  projects.push(project)
  save(KEYS.projects, projects)
  // init empty estimate lines for project
  const estimates = load(KEYS.estimates, {})
  estimates[project.id] = {}
  TRADES.forEach(t => { estimates[project.id][t.id] = [] })
  save(KEYS.estimates, estimates)
  return project
}

export const updateProject = (id, data) => {
  const projects = getProjects().map(p => p.id === id ? { ...p, ...data } : p)
  save(KEYS.projects, projects)
}

export const deleteProject = (id) => {
  save(KEYS.projects, getProjects().filter(p => p.id !== id))
  const estimates = load(KEYS.estimates, {})
  delete estimates[id]
  save(KEYS.estimates, estimates)
}

// ── ESTIMATE LINES ────────────────────────────────────────────────────────────
export const getEstimate = (projectId) => {
  const estimates = load(KEYS.estimates, {})
  const est = estimates[projectId] || {}
  TRADES.forEach(t => { if (!est[t.id]) est[t.id] = [] })
  return est
}

export const saveTradeLines = (projectId, tradeId, lines) => {
  const estimates = load(KEYS.estimates, {})
  if (!estimates[projectId]) estimates[projectId] = {}
  estimates[projectId][tradeId] = lines
  save(KEYS.estimates, estimates)
}

export const addLine = (projectId, tradeId, line = {}) => {
  const estimates = load(KEYS.estimates, {})
  if (!estimates[projectId]) estimates[projectId] = {}
  if (!estimates[projectId][tradeId]) estimates[projectId][tradeId] = []
  const newLine = {
    id: uid(),
    description: '',
    factor: '',
    quantity: '',
    unit: 'no',
    unit_rate: '',
    markup_pct: 0.20,
    source: 'manual',
    ...line,
  }
  estimates[projectId][tradeId].push(newLine)
  save(KEYS.estimates, estimates)
  return newLine
}

export const updateLine = (projectId, tradeId, lineId, data) => {
  const estimates = load(KEYS.estimates, {})
  estimates[projectId][tradeId] = estimates[projectId][tradeId].map(l =>
    l.id === lineId ? { ...l, ...data } : l
  )
  save(KEYS.estimates, estimates)
}

export const deleteLine = (projectId, tradeId, lineId) => {
  const estimates = load(KEYS.estimates, {})
  estimates[projectId][tradeId] = estimates[projectId][tradeId].filter(l => l.id !== lineId)
  save(KEYS.estimates, estimates)
}

// ── RATES LIBRARY ─────────────────────────────────────────────────────────────
export const getRates = () => load(KEYS.rates)

export const saveRate = (rate) => {
  const rates = getRates()
  const existing = rates.findIndex(r => r.id === rate.id)
  if (existing >= 0) rates[existing] = rate
  else rates.push({ id: uid(), ...rate })
  save(KEYS.rates, rates)
}

export const deleteRate = (id) => save(KEYS.rates, getRates().filter(r => r.id !== id))

export const importRatesFromSpreadsheet = (items) => {
  const rates = getRates()
  items.forEach(item => {
    rates.push({ id: uid(), ...item })
  })
  save(KEYS.rates, rates)
}

// ── SUBCONTRACTORS ────────────────────────────────────────────────────────────
export const getSubcontractors = () => load(KEYS.subcontractors)

export const saveSubcontractor = (sub) => {
  const subs = getSubcontractors()
  const existing = subs.findIndex(s => s.id === sub.id)
  if (existing >= 0) subs[existing] = sub
  else subs.push({ id: uid(), ...sub })
  save(KEYS.subcontractors, subs)
}

export const deleteSubcontractor = (id) => {
  save(KEYS.subcontractors, getSubcontractors().filter(s => s.id !== id))
}

// ── CALCULATIONS ──────────────────────────────────────────────────────────────
export const calcLine = (line) => {
  const qty = parseFloat(line.quantity) || 0
  const factor = parseFloat(line.factor) || 1
  const rate = parseFloat(line.unit_rate) || 0
  const markup = parseFloat(line.markup_pct) || 0
  const subtotal = qty * factor * rate
  const markupAmt = subtotal * markup
  const total = subtotal + markupAmt
  return { subtotal, markupAmt, total }
}

export const calcProjectSummary = (projectId, marginPct = 0.20) => {
  const estimate = getEstimate(projectId)
  const tradeTotals = {}
  let tradeCost = 0

  TRADES.forEach(trade => {
    const lines = estimate[trade.id] || []
    const tradeTotal = lines.reduce((sum, l) => sum + calcLine(l).total, 0)
    tradeTotals[trade.id] = tradeTotal
    tradeCost += tradeTotal
  })

  const marginAmt = tradeCost * marginPct
  const subtotal = tradeCost + marginAmt
  const gst = subtotal * 0.10
  const total = subtotal + gst

  return { tradeTotals, tradeCost, marginAmt, subtotal, gst, total }
}

export const fmt = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0)

export const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`
