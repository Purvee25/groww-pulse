import { useState, useEffect } from 'react'
import api from '../lib/api'

interface SectorData {
  count: number
  percentage: number
  stocks: string[]
}

interface PortfolioRiskData {
  total_stocks: number
  sectors: Record<string, SectorData>
  portfolio_volatility: number
  volatility_category: string
  alerts: Array<{ type: string; message: string }>
  summary: string
}

const SECTOR_PALETTE: Record<string, string> = {
  IT:       '#3B82F6',
  Banking:  '#8B5CF6',
  Finance:  '#A78BFA',
  Energy:   '#F59E0B',
  Telecom:  '#EC4899',
  Auto:     '#10B981',
  FMCG:     '#F97316',
  Pharma:   '#14B8A6',
  Metals:   '#64748B',
  Infra:    '#84CC16',
  Other:    '#6B7280',
}

function sectorColor(name: string) {
  return SECTOR_PALETTE[name] ?? SECTOR_PALETTE.Other
}

function volatilityLabel(cat: string) {
  if (cat === 'Low')    return { label: 'Low risk',    color: 'var(--green)' }
  if (cat === 'Medium') return { label: 'Moderate',    color: 'var(--attention, #B8862B)' }
  return                       { label: 'High risk',   color: 'var(--red)' }
}

export function PortfolioRisk() {
  const [data, setData] = useState<PortfolioRiskData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/watchlist/portfolio/risk')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Analysing your portfolio…
      </div>
    )
  }

  if (!data || data.total_stocks === 0) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)',
      }}>
        Add stocks to your watchlist to see the risk breakdown.
      </div>
    )
  }

  const sectors = Object.entries(data.sectors).sort(([, a], [, b]) => b.percentage - a.percentage)
  const volInfo = volatilityLabel(data.volatility_category)
  const sectorCount = sectors.length
  const concentrated = data.alerts.some(a => a.message.toLowerCase().includes('100'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Stat strip ───────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1px', background: 'var(--border)',
        border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
      }}>
        {[
          { label: 'Stocks', value: String(data.total_stocks), accent: 'var(--brand)' },
          { label: 'Sectors', value: String(sectorCount), accent: sectorCount < 3 ? 'var(--attention, #B8862B)' : 'var(--text)' },
          { label: 'Volatility', value: `${(data.portfolio_volatility * 100).toFixed(2)}%`, accent: volInfo.color, sub: volInfo.label },
        ].map(({ label, value, accent, sub }) => (
          <div key={label} style={{
            background: 'var(--surface)', padding: '1.25rem 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.25rem',
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              {label}
            </span>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--mono)', color: accent, lineHeight: 1 }}>
              {value}
            </span>
            {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</span>}
          </div>
        ))}
      </div>

      {/* ── Concentration bar ────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '1.25rem 1.5rem',
      }}>
        <p style={{ margin: '0 0 0.875rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Sector concentration
        </p>

        {/* Stacked bar */}
        <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden', gap: '1px', marginBottom: '1rem' }}>
          {sectors.map(([name, s]) => (
            <div
              key={name}
              title={`${name} ${s.percentage}%`}
              style={{
                flex: s.percentage,
                background: sectorColor(name),
                transition: 'flex 400ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          ))}
        </div>

        {/* Legend rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {sectors.map(([name, s]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: sectorColor(name), flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', minWidth: '70px' }}>{name}</span>
              <div style={{ flex: 1, height: '4px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: '100%',
                  background: sectorColor(name), opacity: 0.7,
                  transform: `scaleX(${s.percentage / 100})`,
                  transformOrigin: 'left',
                  transition: 'transform 400ms cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
              <span style={{ fontSize: '0.78rem', fontFamily: 'var(--mono)', fontWeight: 700, color: sectorColor(name), minWidth: '38px', textAlign: 'right' }}>
                {s.percentage}%
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '72px' }}>
                {s.stocks.map(x => x.replace('.NS', '')).join(', ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerts ───────────────────────────────────────────────────── */}
      {data.alerts.length > 0 && (
        <div style={{
          background: concentrated ? 'rgba(220,38,38,0.06)' : 'rgba(184,134,43,0.08)',
          border: `1px solid ${concentrated ? 'rgba(220,38,38,0.2)' : 'rgba(184,134,43,0.25)'}`,
          borderRadius: '12px', padding: '1rem 1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: concentrated ? 'var(--red)' : 'var(--attention, #B8862B)' }}>
            {concentrated ? 'Concentration risk' : 'Heads up'}
          </p>
          {data.alerts.map((a, i) => (
            <p key={i} style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {a.message}
            </p>
          ))}
        </div>
      )}

      {/* ── Footer tip ───────────────────────────────────────────────── */}
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 0.25rem' }}>
        Diversification across 4+ uncorrelated sectors reduces idiosyncratic risk without sacrificing returns. A 2% move in IT matters more if IT is 80% of your list.
      </p>
    </div>
  )
}
