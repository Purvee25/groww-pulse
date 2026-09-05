import { useState, useEffect } from 'react'
import { NavBar } from '../components/NavBar'
import api from '../lib/api'

interface CheckpointRow {
  id: number
  symbol: string
  price: number
  attention_score: number | null
  checkpoint_at: string
}

interface ReplayResult {
  symbol: string
  away_seconds: number
  stock_return_pct: number
  attention_score: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  narrative: string
  why?: string
  regime: string
  vix: number | null
  thesis_verdict: string | null
  thesis_verdict_reason: string | null
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: 'var(--high-bg)',   text: 'var(--high)' },
  MEDIUM: { bg: 'var(--medium-bg)', text: 'var(--medium)' },
  LOW:    { bg: 'var(--low-bg)',    text: 'var(--low)' },
}

export function TimeMachinePage() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [checkpoints, setCheckpoints] = useState<CheckpointRow[]>([])
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<number | null>(null)
  const [result, setResult] = useState<ReplayResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load user's watchlist symbols on mount
  useEffect(() => {
    api.get('/watchlist').then(res => {
      const syms: string[] = (res.data.stocks || []).map((s: { symbol: string }) => s.symbol)
      setSymbols(syms)
      if (syms.length > 0) setSelectedSymbol(syms[0])
    }).catch(() => {})
  }, [])

  // Load checkpoints when symbol changes
  useEffect(() => {
    if (!selectedSymbol) return
    setCheckpoints([])
    setSelectedCheckpointId(null)
    setResult(null)
    api.get(`/watchlist/${selectedSymbol}/checkpoint-history?limit=20`).then(res => {
      setCheckpoints(res.data)
      if (res.data.length > 0) setSelectedCheckpointId(res.data[0].id)
    }).catch(() => {})
  }, [selectedSymbol])

  const handleReplay = async () => {
    if (!selectedSymbol || selectedCheckpointId === null) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      // Use the simulate endpoint with a large elapsed time to mimic "what if I had
      // been away since that checkpoint". We compute away_seconds from the checkpoint time.
      const cp = checkpoints.find(c => c.id === selectedCheckpointId)
      if (!cp) { setError('Checkpoint not found'); setLoading(false); return }
      const awaySecs = Math.round((Date.now() - new Date(cp.checkpoint_at).getTime()) / 1000)
      const res = await api.get(`/watchlist/${selectedSymbol}/simulate?away_seconds=${awaySecs}`)
      setResult({ symbol: selectedSymbol, away_seconds: awaySecs, ...res.data })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Replay failed')
    } finally {
      setLoading(false)
    }
  }

  const formatCp = (row: CheckpointRow) => {
    const d = new Date(row.checkpoint_at)
    const label = d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const daysAgo = Math.round((Date.now() - d.getTime()) / 86400000)
    return `${label} — ₹${row.price.toFixed(2)} (${daysAgo === 0 ? 'today' : `${daysAgo}d ago`})`
  }

  const formatAway = (secs: number) => {
    if (secs < 3600) return `${Math.round(secs / 60)} min`
    if (secs < 86400) return `${(secs / 3600).toFixed(1)}h`
    return `${(secs / 86400).toFixed(1)} days`
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2.5rem 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem' }}>⏱ Time Machine</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
            Pick a stock and a past checkpoint to see what the brief would have shown — using the real price and your real thesis.
          </p>
        </div>

        {/* Controls */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Symbol
            </label>
            <select
              value={selectedSymbol}
              onChange={e => setSelectedSymbol(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface-2, var(--bg))',
                border: '1px solid var(--border)', borderRadius: '0.5rem',
                color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.95rem',
              }}
            >
              {symbols.map(s => <option key={s} value={s}>{s.replace('.NS', '')}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Checkpoint (when you marked as caught-up)
            </label>
            {checkpoints.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                No checkpoints yet. Hit "Mark as Caught Up" on the dashboard to record one.
              </p>
            ) : (
              <select
                value={selectedCheckpointId ?? ''}
                onChange={e => setSelectedCheckpointId(Number(e.target.value))}
                style={{
                  width: '100%', background: 'var(--surface-2, var(--bg))',
                  border: '1px solid var(--border)', borderRadius: '0.5rem',
                  color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.875rem',
                }}
              >
                {checkpoints.map(cp => (
                  <option key={cp.id} value={cp.id}>{formatCp(cp)}</option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={handleReplay}
            disabled={loading || !selectedSymbol || selectedCheckpointId === null || checkpoints.length === 0}
            style={{
              background: 'var(--brand)', color: 'white', border: 'none',
              borderRadius: '0.5rem', padding: '0.75rem 1.5rem', fontSize: '1rem',
              fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1,
              transition: 'transform 160ms ease-out',
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            {loading ? 'Replaying…' : 'Replay this checkpoint →'}
          </button>
        </div>

        {error && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error)',
            color: 'var(--error)', borderRadius: '0.5rem', padding: '0.75rem 1rem',
            marginBottom: '1rem', fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}

        {/* Result card */}
        {result && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Banner */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              background: 'var(--info-bg)', borderBottom: '1px solid var(--border)',
              padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand)' }}>
                ⏱ TIME MACHINE REPLAY
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                — scored as if you were away {formatAway(result.away_seconds)}
              </span>
            </div>

            <div style={{ marginTop: '2.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
                    {result.symbol.replace('.NS', '')}
                  </h2>
                  <p style={{
                    fontSize: '1.75rem', fontFamily: 'var(--mono)', fontWeight: 700,
                    margin: 0, color: result.stock_return_pct >= 0 ? 'var(--success)' : 'var(--error)',
                  }}>
                    {result.stock_return_pct > 0 ? '+' : ''}{result.stock_return_pct.toFixed(2)}% since checkpoint
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <span style={{
                    background: PRIORITY_COLORS[result.priority]?.bg,
                    color: PRIORITY_COLORS[result.priority]?.text,
                    padding: '0.4rem 0.75rem', borderRadius: '1rem',
                    fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {Math.round(result.attention_score)} Attention · {result.priority}
                  </span>
                  {result.regime === 'HIGH_VOLATILITY_EXPANSION' && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                      borderRadius: '0.3rem', background: 'var(--high-bg)', color: 'var(--high)',
                    }}>
                      VIX REGIME EXPANSION
                    </span>
                  )}
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                {result.narrative}
              </p>
              {result.why && (
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 1rem', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  {result.why}
                </p>
              )}

              {result.thesis_verdict && (
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.5rem',
                }}>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.35rem',
                    background: result.thesis_verdict === 'CHALLENGED' ? 'var(--high-bg)' : result.thesis_verdict === 'SUPPORTED' ? 'var(--low-bg)' : 'var(--medium-bg)',
                    color: result.thesis_verdict === 'CHALLENGED' ? 'var(--high)' : result.thesis_verdict === 'SUPPORTED' ? 'var(--low)' : 'var(--medium)',
                  }}>
                    THESIS {result.thesis_verdict}
                  </span>
                  {result.thesis_verdict_reason && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {result.thesis_verdict_reason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !result && symbols.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '3rem' }}>
            Add stocks to your watchlist first to use the Time Machine.
          </p>
        )}
      </main>
    </div>
  )
}
