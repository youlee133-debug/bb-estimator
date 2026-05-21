import { useState, useRef } from 'react'
import { getProjects, getEstimate, addLine, getRates, TRADES } from '../lib/store'

const SYSTEM_PROMPT = `You are an expert construction estimator specialising in shopfitting and commercial interior fitouts in Australia.

You will be given one or more pages from architectural/engineering drawings for a shopfitting project. Your job is to analyse the drawings and extract quantity takeoffs for each relevant trade.

For each item you identify, return:
- trade_id: one of: prelims, consultant, demo, electrical, mechanical, fire, hydraulics, tiling, glazing, cp, joinery, flooring, painting, signage, stainless
- description: clear description of the work item
- quantity: your best estimate of the quantity (number only)
- unit: m², m, no, ea, hr, day, week, est
- confidence: "high", "medium", or "low"
- note: brief explanation of how you derived the quantity

Rules:
- Only include items you can actually see evidence for in the drawings
- For areas (m²), use dimensions shown or scale indicators if present
- For counts (no/ea), count visible elements in schedules or on plans
- If a schedule is present (door schedule, finish schedule, window schedule), extract from it directly — this gives high confidence
- If estimating from a floor plan without explicit dimensions, mark confidence as "low"
- Do not invent items not evidenced in the drawings
- Focus on what's visible and measurable

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "trade_id": "flooring",
    "description": "Supply and install timber hybrid floor",
    "quantity": 85,
    "unit": "m²",
    "confidence": "medium",
    "note": "Estimated from floor plan area, excluding wet areas"
  }
]`

export default function AITakeoff({ navigate }) {
  const [step, setStep] = useState('setup') // setup | uploading | analysing | review | done
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bb_anthropic_key') || '')
  const [projectId, setProjectId] = useState('')
  const [files, setFiles] = useState([])
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const fileRef = useRef()
  const projects = getProjects()

  const saveKey = (key) => {
    setApiKey(key)
    localStorage.setItem('bb_anthropic_key', key)
  }

  const handleFiles = (e) => {
    const f = Array.from(e.target.files).filter(f => f.type === 'application/pdf')
    setFiles(f)
  }

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const analyseDrawings = async () => {
    if (!apiKey) { setError('Please enter your Anthropic API key'); return }
    if (!projectId) { setError('Please select a project'); return }
    if (files.length === 0) { setError('Please upload at least one PDF drawing'); return }

    setError('')
    setStep('analysing')
    setResults([])

    const allItems = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress({ current: i + 1, total: files.length, label: `Analysing ${file.name}...` })

      try {
        const base64 = await toBase64(file)

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 4000,
            system: SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64,
                  }
                },
                {
                  type: 'text',
                  text: 'Analyse these drawings and return a JSON array of quantity takeoff items for each trade you can identify. Be thorough but only include items with clear evidence in the drawings.'
                }
              ]
            }]
          })
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error?.message || `API error ${response.status}`)
        }

        const data = await response.json()
        const rawText = data.content?.find(b => b.type === 'text')?.text || ''
        // Strip markdown code fences entirely first
        const text = rawText.replace(/```json|```/gi, '').trim()
        console.log('Cleaned text length:', text.length, 'First 100:', text.slice(0, 100))

        let items = []
        try {
          const start = text.indexOf('[')
          const end = text.lastIndexOf(']')
          if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.slice(start, end + 1)
            items = JSON.parse(jsonStr)
            if (!Array.isArray(items)) items = []
          }
          console.log('Parsed', items.length, 'items successfully')
        } catch (parseErr) {
          console.warn('Parse error:', parseErr.message)
        }

        items = items.map((item, j) => ({
          ...item,
          _id: `${i}-${j}`,
          _file: file.name,
          unit_rate: getRateForItem(item, projectId),
        }))

        allItems.push(...items)
      } catch (err) {
        console.error('Error analysing', file.name, err)
        setError(`Error on ${file.name}: ${err.message}`)
      }
    }

    // Pre-select all high/medium confidence items
    const sel = {}
    allItems.forEach(item => {
      sel[item._id] = item.confidence !== 'low'
    })

    setResults(allItems)
    setSelected(sel)
    setStep('review')
  }

  const getRateForItem = (item, projId) => {
    const rates = getRates().filter(r => r.trade_id === item.trade_id)
    const match = rates.find(r =>
      r.description.toLowerCase().includes(item.description.toLowerCase().split(' ').slice(0, 3).join(' ').toLowerCase()) ||
      item.description.toLowerCase().includes(r.description.toLowerCase().split(' ').slice(0, 3).join(' ').toLowerCase())
    )
    return match?.default_rate || 0
  }

  const handleImport = () => {
    const toImport = results.filter(item => selected[item._id])
    toImport.forEach(item => {
      addLine(projectId, item.trade_id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_rate: item.unit_rate,
        markup_pct: 0.20,
        source: 'ai_takeoff',
        factor: '',
      })
    })
    setStep('done')
  }

  const toggleAll = (val) => {
    const sel = {}
    results.forEach(r => { sel[r._id] = val })
    setSelected(sel)
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  // Group results by trade
  const byTrade = {}
  results.forEach(item => {
    if (!byTrade[item.trade_id]) byTrade[item.trade_id] = []
    byTrade[item.trade_id].push(item)
  })

  const tradeName = (id) => TRADES.find(t => t.id === id)?.name || id

  const confColor = (c) => ({ high: '#4cffb0', medium: '#ffb84c', low: '#9998a0' })[c] || '#9998a0'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI drawing takeoff</h1>
          <p className="page-sub">Upload PDF drawings — Claude reads them and generates quantity estimates</p>
        </div>
      </div>

      {/* ── SETUP ── */}
      {(step === 'setup' || step === 'uploading') && (
        <div className="takeoff-setup">

          {/* API Key */}
          <div className="setup-section">
            <h3 className="setup-heading">Anthropic API key</h3>
            <p className="setup-desc">Stored locally in your browser only — never sent anywhere except directly to Anthropic.</p>
            <div className="api-key-row">
              <input
                type="password"
                className="api-key-input"
                value={apiKey}
                onChange={e => saveKey(e.target.value)}
                placeholder="sk-ant-..."
              />
              {apiKey && <span className="key-ok">✓ Key saved</span>}
            </div>
          </div>

          {/* Project select */}
          <div className="setup-section">
            <h3 className="setup-heading">Select project</h3>
            <select className="filter-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Choose a project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
            </select>
          </div>

          {/* File upload */}
          <div className="setup-section">
            <h3 className="setup-heading">Upload drawings</h3>
            <p className="setup-desc">PDF format. You can upload multiple files — each will be analysed separately.</p>
            <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleFiles} />
            <div className="upload-zone" onClick={() => fileRef.current.click()}>
              {files.length === 0 ? (
                <>
                  <div className="upload-icon">⬆</div>
                  <p>Click to upload PDF drawings</p>
                  <span className="upload-hint">Architectural, engineering, schedules — all supported</span>
                </>
              ) : (
                <div className="file-list">
                  {files.map((f, i) => (
                    <div key={i} className="file-item">
                      <span className="file-icon">📄</span>
                      <span className="file-name">{f.name}</span>
                      <span className="file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  ))}
                  <button className="btn-ghost-sm" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); fileRef.current.click() }}>
                    + Add more
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={analyseDrawings}
            disabled={!apiKey || !projectId || files.length === 0}
          >
            Analyse drawings with AI →
          </button>
        </div>
      )}

      {/* ── ANALYSING ── */}
      {step === 'analysing' && (
        <div className="analysing-state">
          <div className="analysing-spinner">◈</div>
          <h2>Analysing drawings</h2>
          <p>{progress.label}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
          <span className="progress-label">{progress.current} of {progress.total} files</span>
          {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}
        </div>
      )}

      {/* ── REVIEW ── */}
      {step === 'review' && (
        <div className="review-panel">
          <div className="review-header">
            <div>
              <h2 className="review-title">{results.length} items extracted</h2>
              <p className="review-sub">Review and deselect any items before importing to your estimate</p>
            </div>
            <div className="review-actions">
              <button className="btn-ghost-sm" onClick={() => toggleAll(true)}>Select all</button>
              <button className="btn-ghost-sm" onClick={() => toggleAll(false)}>Deselect all</button>
              <button className="btn-primary" onClick={handleImport} disabled={selectedCount === 0}>
                Import {selectedCount} items to estimate →
              </button>
            </div>
          </div>

          <div className="confidence-legend">
            <span style={{ color: confColor('high') }}>● High confidence</span>
            <span style={{ color: confColor('medium') }}>● Medium confidence</span>
            <span style={{ color: confColor('low') }}>● Low confidence</span>
          </div>

          <div className="review-body">
            {Object.entries(byTrade).map(([tradeId, items]) => (
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
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Rate</th>
                      <th>Confidence</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item._id} className={selected[item._id] ? '' : 'deselected'}>
                        <td className="col-check">
                          <input type="checkbox" checked={!!selected[item._id]}
                            onChange={e => setSelected({ ...selected, [item._id]: e.target.checked })} />
                        </td>
                        <td className="import-desc">{item.description}</td>
                        <td className="import-unit" style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td className="import-unit">{item.unit}</td>
                        <td className="import-rate">{item.unit_rate > 0 ? `$${item.unit_rate.toLocaleString()}` : '—'}</td>
                        <td>
                          <span className="conf-badge" style={{ color: confColor(item.confidence) }}>
                            ● {item.confidence}
                          </span>
                        </td>
                        <td className="note-cell">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div className="done-state">
          <div className="done-icon">✓</div>
          <h2>Items imported to estimate</h2>
          <p>Go to your project to review, adjust quantities, and apply rates.</p>
          <div className="done-actions">
            <button className="btn-primary" onClick={() => {
              const p = projects.find(pr => pr.id === projectId)
              navigate('project', p)
            }}>Open project →</button>
            <button className="btn-ghost" onClick={() => {
              setStep('setup'); setResults([]); setFiles([]); setSelected({})
            }}>Run another takeoff</button>
          </div>
        </div>
      )}
    </div>
  )
}
