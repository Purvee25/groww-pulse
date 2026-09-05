import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { TimeMachine } from '../components/TimeMachine'
import { useWatchlist } from '../hooks/useWatchlist'
import api from '../lib/api'

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: 'var(--high-bg)', text: 'var(--high)' },
  MEDIUM: { bg: 'var(--medium-bg)', text: 'var(--medium)' },
  LOW: { bg: 'var(--low-bg)', text: 'var(--low)' },
}

/** Shareable, direct-link detail page for one symbol — her /w/[id] equivalent.
 * Sources from the shared watchlist store (loaded by useWatchlist) rather
 * than a separate fetch, so it's always consistent with what the grid and
 * deck show for the same stock. */
export function StockPage() {
  const { symbol } = useParams<{ symbol: string }>()
  const { brief, loading, loadBrief } = useWatchlist()
  const [thesisResponse, setThesisResponse] = useState<'supports' | 'challenges' | 'uncertain' | null>(null)
  const [metadata, setMetadata] = useState<{ company_name: string; sector?: string } | null>(null)
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [revalidating, setRevalidating] = useState(false)

  const item = brief.find((s) => s.symbol.replace('.NS', '').toUpperCase() === (symbol || '').toUpperCase())

  useEffect(() => {
    setThesisResponse(null)
    setMetadata(null)
  }, [symbol])

  useEffect(() => {
    if (!item) return
    api.get(`/markets/symbol-metadata/${item.symbol}`)
      .then((res) => setMetadata(res.data))
      .catch((error) => console.error('Failed to fetch metadata:', error))
  }, [item?.symbol])

  const handleRevalidateThesis = async () => {
    if (!item) return
    setRevalidating(true)
    try {
      await api.post(`/watchlist/${item.symbol}/thesis/revalidate`)
      await loadBrief()
    } catch (error) {
      console.error('Failed to re-validate thesis:', error)
    } finally {
      setRevalidating(false)
    }
  }

  const handleThesisResponse = async (response: 'supports' | 'challenges' | 'uncertain') => {
    if (!item) return
    setThesisResponse(response)
    try {
      await api.post(`/watchlist/${item.symbol}/response`, { response })
    } catch (error) {
      console.error('Failed to save thesis response:', error)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1rem' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : !item ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              "{symbol}" isn't in your watchlist
            </p>
            <Link to="/watchlist" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
              ← Back to watchlist
            </Link>
          </div>
        ) : (
          <>
            <Link to="/watchlist" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1.5rem', display: 'inline-block' }}>
              ← Back to watchlist
            </Link>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <h1 style={{ fontSize: '2.25rem', fontWeight: 700, margin: 0, color: 'var(--brand)' }}>
                    {item.symbol.replace('.NS', '')}
                  </h1>
                  {metadata?.sector && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.6rem',
                      background: 'var(--info-bg)',
                      color: 'var(--info)',
                      borderRadius: '0.25rem',
                      fontWeight: 600,
                    }}>
                      {metadata.sector}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>
                  {metadata?.company_name || item.company_name}
                </p>
              </div>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.4rem 0.8rem',
                borderRadius: '1rem',
                background: (PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.LOW).bg,
                color: (PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.LOW).text,
              }}>
                {Math.round(item.attention_score)} · {item.priority}
              </span>
            </div>

            <p style={{
              fontSize: '3rem',
              fontFamily: 'var(--mono)',
              fontWeight: 700,
              margin: '0 0 0.5rem 0',
              color: (item.price_change_pct ?? 0) >= 0 ? 'var(--success)' : 'var(--error)',
            }}>
              {(item.price_change_pct ?? 0) > 0 ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>since checkpoint</p>

            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                Why it's flagged
              </p>
              <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {item.narration}
              </p>
              {!showTimeMachine && (
                <button
                  onClick={() => setShowTimeMachine(true)}
                  style={{
                    marginTop: '1rem',
                    background: 'transparent',
                    color: 'var(--brand)',
                    border: '1px solid var(--brand)',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⏱ What if I'd been away longer?
                </button>
              )}
            </div>

            {showTimeMachine && (
              <TimeMachine symbol={item.symbol} onClose={() => setShowTimeMachine(false)} />
            )}

            {item.thesis_note && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Your thesis
                  </p>
                  {item.thesis_stale && (
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--medium)',
                      background: 'var(--medium-bg)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.4rem',
                    }}>
                      THESIS STALE — REQUIRES VALIDATION
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                  "{item.thesis_note}"
                </p>
                {item.thesis_stale && (
                  <button
                    onClick={handleRevalidateThesis}
                    disabled={revalidating}
                    style={{
                      marginTop: '0.75rem',
                      background: 'transparent',
                      color: 'var(--brand)',
                      border: '1px solid var(--brand)',
                      padding: '0.35rem 0.8rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: revalidating ? 'not-allowed' : 'pointer',
                      opacity: revalidating ? 0.6 : 1,
                    }}
                  >
                    {revalidating ? 'Saving…' : 'Re-validate thesis'}
                  </button>
                )}

                {(item.priority === 'HIGH' || item.priority === 'MEDIUM') && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                      Does this move support or challenge your thesis?
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(['supports', 'challenges', 'uncertain'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleThesisResponse(r)}
                          style={{
                            background: thesisResponse === r ? 'var(--brand)' : 'transparent',
                            color: thesisResponse === r ? 'white' : 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {item.market_state === 'closed' ? 'Market Closed' : item.freshness.toUpperCase()}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
