import { useState, useEffect, useRef } from 'react'
import {
  TRADES, UNITS, getEstimate, addLine, updateLine, deleteLine,
  calcLine, calcProjectSummary, updateProject, saveTradeLines,
  fmt, fmtPct, getRates
} from '../lib/store'

export default function ProjectView({ project, navigate }) {
  const [activeTrade, setActiveTrade] = useState(TRADES[0].id)
  const [estimate, setEstimate] = useState({})
  const [proj, setProj] = useState(project)
  const [showSummary, setShowSummary] = useState(false)

  const reload = () => setEstimate(getEstimate(proj.id))

  useEffect(() => { reload() }, [proj.id])

  const summary = calcProjectSummary(proj.id, proj.margin_pct)
  const trade = TRADES.find(t => t.id === activeTrade)
  const lines = estimate[activeTrade] || []

  const handleAddLine = () => {
    addLine(proj.id, activeTrade)
    reload()
  }

  const handleUpdate = (lineId, field, value) => {
    updateLine(proj.id, activeTrade, lineId, { [field]: value })
    reload()
  }

  const handleDelete = (lineId) => {
    deleteLine(proj.id, activeTrade, lineId)
    reload()
  }

  const handleMarginChange = (val) => {
    const m = parseFloat(val) / 100
    updateProject(proj.id, { margin_pct: m })
    setProj({ ...proj, margin_pct: m })
  }

  const handleAddFromLibrary = () => {
    const rates = getRates().filter(r => r.trade_id === activeTrade)
    if (rates.length === 0) { alert('No rates in library for this trade yet.'); return }
    rates.forEach(r => {
      addLine(proj.id, activeTrade, {
        description: r.description,
        unit: r.unit,
        unit_rate: r.default_rate,
        markup_pct: r.markup_pct || 0.20,
        source: 'library',
      })
    })
    reload()
  }

  return (
    <div className="page project-page">
      <div className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-back" onClick={() => navigate('dashboard')}>← Projects</button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{proj.name}</span>
        </div>
        <div className="header-actions">
          <button className="btn-ghost" onClick={() => setShowSummary(!showSummary)}>
            {showSummary ? 'Hide summary' : 'Show summary'}
          </button>
        </div>
      </div>

      <div className="project-meta">
        <span className="meta-item"><span className="meta-label">Client</span>{proj.client}</span>
        {proj.address && <span className="meta-item"><span className="meta-label">Site</span>{proj.address}</span>}
        {proj.tenancy_m2 > 0 && <span className="meta-item"><span className="meta-label">Tenancy</span>{proj.tenancy_m2} m²</span>}
      </div>

      {showSummary && (
        <CostSummary summary={summary} proj={proj} onMarginChange={handleMarginChange} />
      )}

      <div className="trade-layout">
        <div className="trade-sidebar">
          {TRADES.map(t => {
            const tot = summary.tradeTotals[t.id] || 0
            return (
              <button
                key={t.id}
                className={`trade-tab ${activeTrade === t.id ? 'active' : ''} ${tot > 0 ? 'has-data' : ''}`}
                onClick={() => setActiveTrade(t.id)}
              >
                <span className="trade-tab-name">{t.name}</span>
                <span className="trade-tab-total">{tot > 0 ? fmt(tot) : ''}</span>
              </button>
            )
          })}
        </div>

        <div className="trade-content">
          <div className="trade-content-header">
            <div>
              <h2 className="trade-title">{trade.name}</h2>
              <span className="trade-code">Cost code {trade.code}</span>
            </div>
            <div className="trade-actions">
              <button className="btn-ghost-sm" onClick={handleAddFromLibrary}>+ From library</button>
              <button className="btn-primary-sm" onClick={handleAddLine}>+ Add line</button>
            </div>
          </div>

          <div className="estimate-table-wrap">
            <table className="estimate-table">
              <thead>
                <tr>
                  <th className="col-desc">Description</th>
                  <th className="col-factor">Factor</th>
                  <th className="col-qty">Qty</th>
                  <th className="col-unit">Unit</th>
                  <th className="col-rate">Unit rate</th>
                  <th className="col-sub">Subtotal</th>
                  <th className="col-markup">Markup %</th>
                  <th className="col-total">Total</th>
                  <th className="col-del"></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">No items yet — add a line or import from library</td>
                  </tr>
                )}
                {lines.map(line => {
                  const { subtotal, total } = calcLine(line)
                  return (
                    <tr key={line.id} className="estimate-row">
                      <td className="col-desc">
                        <input
                          className="cell-input desc-input"
                          value={line.description}
                          onChange={e => handleUpdate(line.id, 'description', e.target.value)}
                          placeholder="Description"
                        />
                      </td>
                      <td className="col-factor">
                        <input
                          className="cell-input num-input"
                          type="number"
                          value={line.factor}
                          onChange={e => handleUpdate(line.id, 'factor', e.target.value)}
                          placeholder="1"
                        />
                      </td>
                      <td className="col-qty">
                        <input
                          className="cell-input num-input"
                          type="number"
                          value={line.quantity}
                          onChange={e => handleUpdate(line.id, 'quantity', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="col-unit">
                        <select
                          className="cell-select"
                          value={line.unit}
                          onChange={e => handleUpdate(line.id, 'unit', e.target.value)}
                        >
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="col-rate">
                        <input
                          className="cell-input num-input"
                          type="number"
                          value={line.unit_rate}
                          onChange={e => handleUpdate(line.id, 'unit_rate', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="col-sub calc-cell">{subtotal > 0 ? fmt(subtotal) : '—'}</td>
                      <td className="col-markup">
                        <input
                          className="cell-input num-input"
                          type="number"
                          value={Math.round((parseFloat(line.markup_pct) || 0) * 100)}
                          onChange={e => handleUpdate(line.id, 'markup_pct', parseFloat(e.target.value) / 100)}
                          placeholder="20"
                        />
                      </td>
                      <td className="col-total calc-cell total-cell">{total > 0 ? fmt(total) : '—'}</td>
                      <td className="col-del">
                        <button className="del-btn" onClick={() => handleDelete(line.id)}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {lines.length > 0 && (
                <tfoot>
                  <tr className="trade-total-row">
                    <td colSpan={7} className="trade-total-label">Trade total (excl. GST)</td>
                    <td className="trade-total-value">{fmt(summary.tradeTotals[activeTrade] || 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function CostSummary({ summary, proj, onMarginChange }) {
  const { tradeTotals, tradeCost, marginAmt, subtotal, gst, total } = summary
  const costPerM2 = proj.tenancy_m2 > 0 ? total / proj.tenancy_m2 : 0

  return (
    <div className="summary-panel">
      <div className="summary-left">
        <h3 className="summary-heading">Cost summary</h3>
        <div className="summary-trades">
          {TRADES.filter(t => tradeTotals[t.id] > 0).map(t => (
            <div key={t.id} className="summary-trade-row">
              <span className="summary-trade-name">{t.name}</span>
              <span className="summary-trade-val">{fmt(tradeTotals[t.id])}</span>
            </div>
          ))}
          {Object.values(tradeTotals).every(v => v === 0) && (
            <div className="summary-empty">No costs entered yet</div>
          )}
        </div>
      </div>

      <div className="summary-right">
        <div className="summary-totals">
          <div className="summary-row">
            <span>Trade cost</span>
            <span>{fmt(tradeCost)}</span>
          </div>
          <div className="summary-row margin-row">
            <span>
              Margin
              <input
                className="margin-input"
                type="number"
                value={Math.round((proj.margin_pct || 0.20) * 100)}
                onChange={e => onMarginChange(e.target.value)}
              />%
            </span>
            <span>{fmt(marginAmt)}</span>
          </div>
          <div className="summary-row subtotal-row">
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>GST (10%)</span>
            <span>{fmt(gst)}</span>
          </div>
          <div className="summary-row total-row">
            <span>Total (inc. GST)</span>
            <span>{fmt(total)}</span>
          </div>
          {costPerM2 > 0 && (
            <div className="summary-row cost-m2-row">
              <span>Cost per m²</span>
              <span>{fmt(costPerM2)} / m²</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
