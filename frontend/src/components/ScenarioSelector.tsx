import { useEffect, useState } from 'react'
import api from '../lib/api'

interface ScenarioMeta {
  key: string
  label: string
  description: string
}

export interface ScenarioStock {
  symbol: string
  price: number
  thesis: string | null
  stock_return_pct: number
  attention_score: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  narrative: string
  z_score: number
  regime: 'NORMAL' | 'HIGH_VOLATILITY_EXPANSION'
  vix: number
  thesis_verdict: 'SUPPORTED' | 'CHALLENGED' | 'NEUTRAL' | null
  thesis_verdict_reason: string | null
}

interface ScenarioResult {
  is_replay: true
  scenario: string
  label: string
  description: string
  vix: number
  stocks: ScenarioStock[]
}

interface ScenarioSelectorProps {
  onScenarioChange: (result: ScenarioResult | null) => void
}

/** Black-Swan replay switcher. Runs the user's real watchlist through the
 * real scoring pipeline with a historically-shaped return/VIX injected —
 * never fakes a different engine, just feeds this one a dramatic input on
 * demand instead of hoping the live market cooperates during a demo. */
export function ScenarioSelector({ onScenarioChange }: ScenarioSelectorProps) {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/watchlist/scenarios')
      .then((res) => setScenarios(res.data.scenarios || []))
      .catch((error) => console.error('Failed to load scenarios:', error))
  }, [])

  const selectScenario = async (key: string | null) => {
    if (key === active) return
    setActive(key)
    if (key === null) {
      onScenarioChange(null)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/watchlist/scenario/${key}`)
      onScenarioChange(res.data)
    } catch (error) {
      console.error('Failed to load scenario:', error)
      setActive(null)
    } finally {
      setLoading(false)
    }
  }

  const pillStyle = (isActive: boolean) => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    border: isActive ? '1px solid var(--error)' : '1px solid var(--border)',
    background: isActive ? 'var(--error-bg)' : 'var(--surface)',
    color: isActive ? 'var(--error)' : 'var(--text-secondary)',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.25rem' }}>
          Scenario:
        </span>
        <button onClick={() => selectScenario(null)} style={pillStyle(active === null)}>
          Live NSE Feed
        </button>
        {scenarios.map((s) => (
          <button key={s.key} onClick={() => selectScenario(s.key)} style={pillStyle(active === s.key)} title={s.description}>
            {s.label}
          </button>
        ))}
        {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading…</span>}
      </div>
    </div>
  )
}
