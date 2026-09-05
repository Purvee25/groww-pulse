import { useState } from 'react'
import { NavBar } from '../components/NavBar'
import { StockDetail, type BriefItem } from '../components/StockDetail'
import { useWatchlist } from '../hooks/useWatchlist'

const VERDICT_META: Record<string, { color: string; bg: string; icon: string }> = {
  SUPPORTED:  { color: '#00b386', bg: 'rgba(0,179,134,0.1)',   icon: '↑' },
  CHALLENGED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '↓' },
  NEUTRAL:    { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: '→' },
}

function ago(dateStr?: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

export function Journal() {
  const { brief, loading } = useWatchlist()
  const [openItem, setOpenItem] = useState<BriefItem | null>(null)

  const withThesis = brief.filter(b => b.thesis_note)
  const withoutThesis = brief.filter(b => !b.thesis_note)

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      <StockDetail isOpen={openItem !== null} onClose={() => setOpenItem(null)} item={openItem} />

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Decision Journal
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Your thesis for each stock — checked against what the price is actually doing.
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
        ) : withThesis.length === 0 ? (
          /* Empty state */
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(0,179,134,0.1)', border: '1px solid rgba(0,179,134,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', fontSize: '22px',
            }}>📋</div>
            <p style={{ margin: '0 0 0.375rem', fontWeight: 600, color: 'var(--text)' }}>No theses yet</p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Open any stock in your Watchlist and write why you're watching it. The market will tell you if you were right.
            </p>
          </div>
        ) : (
          <>
            {/* Thesis entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem' }}>
              {withThesis.map((item) => {
                const positive = (item.price_change_pct ?? 0) >= 0
                const v = item.thesis_verdict ? VERDICT_META[item.thesis_verdict] : null
                return (
                  <div
                    key={item.symbol}
                    onClick={() => setOpenItem(item)}
                    style={{
                      background: 'var(--surface)', padding: '1.125rem 1.25rem',
                      cursor: 'pointer', transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{
                          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700,
                          background: 'linear-gradient(145deg, rgba(0,179,134,0.15), rgba(0,179,134,0.05))',
                          border: '1px solid rgba(0,179,134,0.2)',
                          color: 'var(--brand)',
                        }}>{item.symbol[0]}</span>
                        <div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{item.symbol.replace('.NS', '')}</span>
                          {item.thesis_stale && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--border)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>stale</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {v && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '999px', background: v.bg, color: v.color }}>
                            {v.icon} {item.thesis_verdict}
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700, color: positive ? 'var(--green)' : 'var(--red)' }}>
                          {positive ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {ago(item.thesis_updated_at)}
                        </span>
                      </div>
                    </div>

                    {/* Thesis */}
                    <p style={{
                      margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {item.thesis_note}
                    </p>

                    {/* Verdict reason */}
                    {item.thesis_verdict_reason && (
                      <p style={{
                        margin: '0.5rem 0 0', fontSize: '0.75rem', lineHeight: 1.45,
                        color: v?.color ?? 'var(--text-muted)',
                        background: v?.bg ?? 'transparent',
                        borderRadius: '6px', padding: '0.375rem 0.5rem',
                      }}>
                        {item.thesis_verdict_reason}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stocks without thesis */}
            {withoutThesis.length > 0 && (
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  No thesis yet ({withoutThesis.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {withoutThesis.map(item => (
                    <button
                      key={item.symbol}
                      onClick={() => setOpenItem(item)}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '8px', padding: '0.4rem 0.875rem',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        color: 'var(--text)', transition: 'border-color 120ms, background 120ms',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--brand)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)' }}
                    >
                      {item.symbol.replace('.NS', '')} +
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
