import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

interface SimResult {
  attention_score: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  narrative: string
  z_score: number
  thesis_verdict?: 'SUPPORTED' | 'CHALLENGED' | 'NEUTRAL' | null
  thesis_verdict_reason?: string | null
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'var(--high-bg)', text: 'var(--high)' },
  MEDIUM: { bg: 'var(--medium-bg)', text: 'var(--medium)' },
  LOW: { bg: 'var(--low-bg)', text: 'var(--low)' },
}

// Marks on the slider: seconds, matched to a human label. The slider itself
// is a plain 0-100 range mapped onto this array's indices so the steps can
// be non-linear (dense near "just now", sparse out toward weeks) without
// exposing seconds math to the UI at all.
const STEPS: { label: string; seconds: number }[] = [
  { label: '2 min', seconds: 120 },
  { label: '15 min', seconds: 900 },
  { label: '1 hour', seconds: 3600 },
  { label: '4 hours', seconds: 14400 },
  { label: '12 hours', seconds: 43200 },
  { label: '1 day', seconds: 86400 },
  { label: '3 days', seconds: 259200 },
  { label: '1 week', seconds: 604800 },
  { label: '2 weeks', seconds: 1209600 },
]

interface TimeMachineProps {
  symbol: string
  onClose: () => void
}

/** Live-demo device for the time-decay z-score claim: same price, same
 * checkpoint, only the hypothetical elapsed time changes — and the
 * attention score visibly moves as you drag. Calls the backend's
 * /simulate endpoint (pure computation, no state written) rather than
 * reimplementing the z-score math in JS, so the slider can never drift
 * out of sync with what the real ranking actually uses. */
export function TimeMachine({ symbol, onClose }: TimeMachineProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)

  const seconds = STEPS[stepIndex].seconds

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/watchlist/${symbol}/simulate`, { params: { away_seconds: seconds } })
      .then((res) => { if (!cancelled) setResult(res.data) })
      .catch((error) => console.error('Time-Machine simulate failed:', error))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol, seconds])

  const priorityColor = useMemo(
    () => (result ? PRIORITY_COLORS[result.priority] : PRIORITY_COLORS.LOW),
    [result]
  )

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      marginBottom: '2rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Time Machine</h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Close ✕
        </button>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Same price, same checkpoint — only "away for" changes. Watch the score decay.
      </p>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.25rem 0' }}>
            Away for
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, fontFamily: 'var(--mono)' }}>
            {STEPS[stepIndex].label}
          </p>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.6rem 1rem',
          borderRadius: '0.5rem',
          background: priorityColor.bg,
          opacity: loading ? 0.5 : 1,
          transition: 'opacity 150ms var(--ease-out), background 200ms var(--ease-out)',
          minWidth: '160px',
        }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: priorityColor.text, fontFamily: 'var(--mono)' }}>
            {result ? result.attention_score.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: priorityColor.text }}>
            {result ? result.priority : ''}
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={STEPS.length - 1}
        step={1}
        value={stepIndex}
        onChange={(e) => setStepIndex(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--brand)',
          marginBottom: '0.5rem',
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span>{STEPS[0].label}</span>
        <span>{STEPS[STEPS.length - 1].label}</span>
      </div>

      {result && (
        <div>
          <p style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border)',
            transition: 'opacity 150ms var(--ease-out)',
            opacity: loading ? 0.5 : 1,
          }}>
            {result.narrative}
          </p>

          {result.thesis_verdict && (
            <div style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0' }}>
                Thesis Verdict
              </p>
              <div style={{
                display: 'inline-block',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
                background: result.thesis_verdict === 'SUPPORTED'
                  ? 'var(--low-bg)'
                  : result.thesis_verdict === 'CHALLENGED'
                  ? 'var(--high-bg)'
                  : 'var(--medium-bg)',
                color: result.thesis_verdict === 'SUPPORTED'
                  ? 'var(--low)'
                  : result.thesis_verdict === 'CHALLENGED'
                  ? 'var(--high)'
                  : 'var(--medium)',
              }}>
                {result.thesis_verdict}
              </div>
              {result.thesis_verdict_reason && (
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  margin: '0.5rem 0 0 0',
                }}>
                  {result.thesis_verdict_reason}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
