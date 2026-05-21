import { useState, useEffect, useRef } from 'react'
import { getRates, saveRate, deleteRate, TRADES, UNITS } from '../lib/store'
import * as XLSX from 'xlsx'

const EMPTY = { trade_id: '', description: '', unit: 'no', default_rate: '', markup_pct: 20, cost_code: '' }

const SHEET_TO_TRADE = {
  'Prelims':     'prelims',
  'Consultant':  'consultant',
  'Demo':        'demo',
  'Electrical':  'electrical',
  'Mechanical':  'mechanical',
  'Fire':        'fire',
  'Hydraulics':  'hydraulics',
  'Tiling':      'tiling',
  'Glazing':     'glazing',
  'C & P':       'cp',
  'Joinery':     'joinery',
  'Flooring':    'flooring',
  'Painting  ':  'painting',
  'Painting':    'painting',
  'Signage':     'signage',
  'Stainless':   'stainless',
}

const SKIP_DESCRIPTIONS = [
  '', ' ', 'SUBCONTRACTOR QUOTES', 'Total (Excl. GST)', 'Markup adjustment',
  'JOINERY', 'FLOORING', 'PAINTING', 'TILING', 'GLAZING', 'SIGNAGE',
  'STAINLESS', 'DEMOLITION', 'ELECTRICAL', 'MECHANICAL', 'FIRE',
  'HYDRAULICS', 'CEILING & PARTITIONS', 'PRELIMINARIES', 'CONSULTANT',
  'STAFF', 'SITE SET UP', 'TRAVEL', 'FINAL CLEAN',
  'JOINERY (Installation)', 'In House Supply and Manufacture',
  'In House Manufacture', 'Outsource', 'Trade Cost',
]

const isSkip = (desc) => {
  if (!desc) return true
  const d = desc.toString().trim()
  if (!d) return true
  if (SKIP_DESCRIPTIONS.some(s => s.trim().toLowerCase() === d.toLowerCase())) return true
  if (d.toUpperCase() === d && d.length > 3) return true
  return false
}

const parseSheet = (ws, tradeId) => {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const items = []
  let headerRow = -1
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => String(c).toLowerCase().includes('description'))) {
      headerRow = i
      break
    }
  }
  if (headerRow === -1) return items
  const header = rows[headerRow].map(c => String(c).toLowerCase().trim())
  const descIdx = header.findIndex(h => h.includes('description'))
  const unitIdx = header.findIndex(h => h === 'unit' || h.includes('unit '))
  const rateIdx = header.findIndex(h => h.includes('unit rate') || h.includes('rate'))
  const markupIdx = header.findIndex(h => h.includes('markup'))
  const codeIdx = header.findIndex(h => h.includes('cost code') || h.includes('code'))
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i]
    const desc = String(row[descIdx] || '').trim()
    if (isSkip(desc)) continue
    const rate = parseFloat(row[rateIdx]) || 0
    const unit = String(row[unitIdx] || 'no').trim() || 'no'
    const markupRaw = parseFloat(row[markupIdx]) || 0.20
    const code = String(row[codeIdx] || '').trim()
    items.push({ trade_id: tradeId, description: desc, unit, default_rate: rate, markup_pct: markupRaw, cost_code: code })
  }
  return items
}

export default function RatesLibrary() {
  const [rates, setRates] = useState([])
  const [filterTrade, setFilterTrade] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importSelected, setImportSelected] = useState({})
  const fileRef = useRef()

  const reload = () => setRates(getRates())
  useEffect(() => { reload() }, [])

  const filtered = filterTrade ? rates.filter(r => r.trade_id === filterTrade) : rates

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const allItems = []
        wb.SheetNames.forEach(sheetName => {
          const tradeId = SHEET_TO_TRADE[sheetName] || SHEET_TO_TRADE[sheetName.trim()]
          if (!tradeId) return
          const ws = wb.Sheets[sheetName]
          const items = parseSheet(ws, tradeId)
          allItems.push(...items)
        })
        const sel = {}
        allItems.forEach((_, i) => { sel[i] = true })
        setImportSelected(sel)
        setImportPreview(allItems)
      } catch (err) {
        alert('Could not read the spreadsheet. Make sure it is the .xlsx file.')
        console.error(err)
      }
      setImporting(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const handleImportConfirm = () => {
    const toImport = importPreview.filter((_, i) => importSelected[i])
    toImport.forEach(item => saveRate(item))
    reload()
    setImportPreview(null)
    setImportSelected({})
  }

  const toggleAll = (val) => {
    const sel = {}
    importPreview.forEach((_, i) => { sel[i] = val })
    setImportSelected(sel)
  }

  const selectedCount = Object.values(importSelected).filter(Boolean).length

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

  const previewByTrade = {}
  if (importPreview) {
    importPreview.forEach((item, i) => {
      if (!previewByTrade[item.trade_id]) previewByTrade[item.trade_id] = []
      previewByTrade[item.trade_id].push({ ...item, _i: i })
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rates library</h1>
          <p className="page-sub">{rates.length} items across {TRADES.length} trades</p>
        </div>
        <div className="header-actions">
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />
          <button className="btn-ghost" onClick={() => fileRef.current.click()}>
            {importing ? 'Reading...' : '↑ Import from spreadsheet'}
          </button>
          <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}>+ Add rate</button>
        </div>
      </div>

      {importPreview && (
        <div className="modal-backdrop">
          <div className="modal modal-xl">
            <div className="modal-header">
              <div>
                <h2>Import preview</h2>
                <p className="modal-sub">{importPreview.length} items found across {Object.keys(previewByTrade).length} trades</p>
              </div>
              <button className="close-btn" onClick={() => setImportPreview(null)}>✕</button>
            </div>
            <div className="import-controls">
              <button className="btn-ghost-sm" onClick={() => toggleAll(true)}>Select all</button>
              <button className="btn-ghost-sm" onClick={() => toggleAll(false)}>Deselect all</button>
              <span className="filter-count">{selectedCount} selected</span>
            </div>
            <div className="import-preview-body">
              {Object.entries(previewByTrade).map(([tradeId, items]) => (
                <div key={tradeId} className="import-trade-group">
                  <div className="import-trade-header">
                    <span className="trade-badge">{tradeName(tradeId)}</span>
                    <span className="import-trade-count">{items.length} items</span>
                  </div>
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th className="col-check"></th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Markup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item._i} className={importSelected[item._i] ? '' : 'deselected'}>
                          <td className="col-check">
                            <input type="checkbox" checked={!!importSelected[item._i]}
                              onChange={e => setImportSelected({ ...importSelected, [item._i]: e.target.checked })} />
                          </td>
                          <td className="import-desc">{item.description}</td>
                          <td className="import-unit">{item.unit}</td>
                          <td className="import-rate">{item.default_rate > 0 ? `$${item.default_rate.toLocaleString()}` : '—'}</td>
                          <td className="import-markup">{Math.round((item.markup_pct || 0.2) * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setImportPreview(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleImportConfirm} disabled={selectedCount === 0}>
                Import {selectedCount} items
              </button>
            </div>
          </div>
        </div>
      )}

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

      <div className="filter-bar">
        <select className="filter-select" value={filterTrade} onChange={e => setFilterTrade(e.target.value)}>
          <option value="">All trades</option>
          {TRADES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="filter-count">{filtered.length} items</span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <p>No rates yet. Import from your spreadsheet or add items manually.</p>
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
                  <td className="rate-val">{r.default_rate > 0 ? `$${(r.default_rate || 0).toLocaleString()}` : '—'}</td>
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
