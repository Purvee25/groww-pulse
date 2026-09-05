import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { AttentionDeck } from '../components/AttentionDeck'
import { TimeMachine } from '../components/TimeMachine'
import { StockDetail, type BriefItem } from '../components/StockDetail'
import { ScenarioSelector, type ScenarioStock } from '../components/ScenarioSelector'
import { MarketRail } from '../components/MarketRail'
import { WatchlistPicker } from '../components/WatchlistPicker'
import { useLiveBrief, formatLastChecked } from '../hooks/useWatchlist'
import { OnboardingModal } from '../components/OnboardingModal'
import api from '../lib/api'

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: 'var(--high-bg)',   text: 'var(--high)' },
  MEDIUM: { bg: 'var(--medium-bg)', text: 'var(--medium)' },
  LOW:    { bg: 'var(--low-bg)',    text: 'var(--low)' },
}

function ClockIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )
}

export function Dashboard() {
  const [activeWatchlistId, setActiveWatchlistId] = useState<number | null>(null)
  const { brief, loading, marking, errorMsg, lastChecked, stockCount, totalChange, handleMarkCaughtUp, wsConnected } =
    useLiveBrief(activeWatchlistId)
  const [deckItem, setDeckItem] = useState<BriefItem | null>(null)
  const [showTimeMachine, setShowTimeMachine] = useState(false)
  const [scenario, setScenario] = useState<{ label: string; description: string; vix: number; stocks: ScenarioStock[] } | null>(null)
  const [scenarioOpen, setScenarioOpen] = useState(false)
  const scenarioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scenarioOpen) return
    const handler = (e: MouseEvent) => {
      if (scenarioRef.current && !scenarioRef.current.contains(e.target as Node)) setScenarioOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [scenarioOpen])

  const worthALook = brief.filter((item) => item.priority === 'HIGH' || item.priority === 'MEDIUM')
  const railItems = brief.map((item) => ({
    label: item.symbol.replace('.NS', ''),
    price: item.price,
    change_pct: item.price_change_pct ?? 0,
  }))

  const now = Date.now()

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <OnboardingModal />
      <NavBar />
      <MarketRail items={railItems} />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>

        {errorMsg && (
          <div style={{
            background: 'var(--error-bg)', border: '1px solid var(--error)',
            color: 'var(--error)', padding: '0.75rem 1rem',
            borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.875rem',
          }} role="alert">
            {errorMsg}
          </div>
        )}

        {/* ── Scenario replay mode ── */}
        {scenario ? (
          <>
            <div style={{
              background: 'var(--error-bg)', border: '2px solid var(--error)',
              borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1.25rem',
            }}>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--error)', fontSize: '0.9rem' }}>
                REPLAY MODE — {scenario.label}
              </p>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {scenario.description} · Simulated VIX: {scenario.vix.toFixed(1)}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '2rem' }}>
              {scenario.stocks.map((s) => {
                const colors = PRIORITY_COLORS[s.priority]
                return (
                  <div key={s.symbol} style={{
                    background: 'var(--surface)',
                    border: `1px solid ${s.priority === 'HIGH' ? 'var(--error)' : 'var(--border)'}`,
                    borderRadius: '10px', padding: '1.125rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{s.symbol.replace('.NS', '')}</p>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s.narrative}</p>
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '6px', background: colors.bg, color: colors.text }}>
                        {s.attention_score.toFixed(1)} · {s.priority}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => setScenario(null)}
              style={{
                background: 'var(--surface-hover)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: '6px',
                padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Exit scenario
            </button>
          </>
        ) : (
          <>
            {/* ── Editorial hero + toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <div style={{ maxWidth: '600px' }}>
                <p style={{
                  margin: '0 0 0.625rem', fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  color: 'var(--brand)',
                }}>
                  Market Watchlist
                </p>
                <h1 style={{ margin: '0 0 0.75rem', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
                  What deserves your attention
                </h1>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '520px' }}>
                  Not another price table. We remember what you saw last time, then weigh every move against that stock's own normal swings and its sector's — so a quiet stock twitching gets flagged, and a volatile one doing the same doesn't.
                </p>
                {!loading && stockCount > 0 && (
                  <p style={{ margin: '0.875rem 0 0', fontSize: '0.875rem' }}>
                    <span style={{ color: worthALook.length > 0 ? 'var(--attention, #B8862B)' : 'var(--green)', fontWeight: 700 }}>
                      {worthALook.length > 0
                        ? `${worthALook.length} stock${worthALook.length > 1 ? 's' : ''} worth a look`
                        : 'All caught up'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}> · {stockCount} tracked</span>
                  </p>
                )}
              </div>

              {/* Right-side controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', alignItems: 'flex-end', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WatchlistPicker activeId={activeWatchlistId} onChange={setActiveWatchlistId} />
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                    borderRadius: '999px', letterSpacing: '0.4px',
                    background: wsConnected ? 'rgba(0,179,134,0.12)' : 'rgba(245,158,11,0.12)',
                    color: wsConnected ? 'var(--green)' : 'var(--amber)',
                  }}>
                    {wsConnected ? '● Live' : '○ Polling'}
                  </span>
                </div>

                <button
                  onClick={handleMarkCaughtUp}
                  disabled={marking || stockCount === 0}
                  style={{
                    background: worthALook.length > 0 ? 'var(--brand)' : 'var(--surface)',
                    color: worthALook.length > 0 ? 'white' : 'var(--text-muted)',
                    border: worthALook.length > 0 ? 'none' : '1px solid var(--border)',
                    padding: '0.5rem 1.25rem', borderRadius: '8px',
                    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    opacity: marking || stockCount === 0 ? 0.5 : 1,
                    transition: 'opacity 150ms, background 150ms',
                  }}
                >
                  {marking ? 'Saving…' : worthALook.length > 0 ? 'Mark as Caught Up' : '✓ Caught up'}
                </button>

                <div ref={scenarioRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setScenarioOpen(o => !o)}
                    style={{
                      background: 'var(--surface)', color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: '6px',
                      padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    ⚙ Scenario
                  </button>
                  {scenarioOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 0.5rem)', right: 0,
                      zIndex: 40, background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: '10px',
                      boxShadow: 'var(--shadow-lg)', padding: '0.75rem', minWidth: '320px',
                    }}>
                      <ScenarioSelector onScenarioChange={(s) => { setScenario(s); setScenarioOpen(false) }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Zone 1: Attention section ── */}
            {!loading && stockCount > 0 && (
              <div style={{ marginBottom: '2.5rem' }}>
                {worthALook.length > 0 ? (
                  <>
                    <AttentionDeck items={worthALook} onRefresh={handleMarkCaughtUp} refreshing={marking} />

                    {!showTimeMachine ? (
                      <button
                        onClick={() => setShowTimeMachine(true)}
                        style={{
                          width: '100%', marginBottom: '1.5rem',
                          background: 'var(--surface)', color: 'var(--brand)',
                          border: '1px solid var(--border)', borderRadius: '8px',
                          padding: '0.75rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        ⏱ Time Machine — see how "away for" changes {worthALook[0].symbol}'s score
                      </button>
                    ) : (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <TimeMachine symbol={worthALook[0].symbol} onClose={() => setShowTimeMachine(false)} />
                      </div>
                    )}
                  </>
                ) : (
                  /* Calm state — all caught up */
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '14px', padding: '2.5rem 2rem', textAlign: 'center',
                  }}>
                    <ClockIcon />
                    <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Nothing meaningful changed since {formatLastChecked(lastChecked)}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Your {stockCount} stocks are quiet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{
                height: '200px', borderRadius: '14px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }} aria-hidden="true">
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading…</span>
              </div>
            )}

            {/* ── Zone 2: Watchlist overview with inline stock chips ── */}
            {!loading && stockCount > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Your stocks
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: (totalChange ?? 0) >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                    avg {(totalChange ?? 0) > 0 ? '+' : ''}{(totalChange ?? 0).toFixed(2)}%
                  </span>
                </div>

                {/* Watchlist card — inspired by Pulse's card layout */}
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', overflow: 'hidden',
                }}>
                  {/* Card header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Watchlist</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {stockCount} stocks · Last checked {formatLastChecked(lastChecked)}
                      </span>
                    </div>
                    {worthALook.length > 0 ? (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.625rem',
                        borderRadius: '999px', background: 'rgba(184,134,43,0.15)',
                        color: 'var(--attention, #B8862B)',
                      }}>
                        {worthALook.length} worth a look
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '0.25rem 0.625rem',
                        borderRadius: '999px', background: 'rgba(0,179,134,0.12)',
                        color: 'var(--green)',
                      }}>
                        Caught up ✓
                      </span>
                    )}
                  </div>

                  {/* Stock rows */}
                  {brief.map((item, i) => {
                    const positive = (item.price_change_pct ?? 0) >= 0
                    return (
                      <div
                        key={item.symbol}
                        onClick={() => setDeckItem(item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.75rem 1.25rem', cursor: 'pointer',
                          borderBottom: i < brief.length - 1 ? '1px solid var(--border)' : 'none',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Avatar */}
                        <span style={{
                          width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700,
                          background: 'linear-gradient(145deg, rgba(0,179,134,0.15), rgba(0,179,134,0.05))',
                          border: '1px solid rgba(0,179,134,0.2)', color: 'var(--brand)',
                        }}>
                          {item.symbol[0]}
                        </span>

                        {/* Symbol + company */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.symbol.replace('.NS', '')}</span>
                            <span style={{
                              width: '5px', height: '5px', borderRadius: '50%',
                              background: item.priority === 'HIGH' ? 'var(--high)' : item.priority === 'MEDIUM' ? 'var(--medium)' : 'var(--border)',
                            }} />
                          </div>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.company_name}
                          </p>
                        </div>

                        {/* Price */}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 700, minWidth: '64px', textAlign: 'right' }}>
                          ₹{item.price.toFixed(2)}
                        </span>

                        {/* Change */}
                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700,
                          minWidth: '55px', textAlign: 'right',
                          color: positive ? 'var(--green)' : 'var(--red)',
                        }}>
                          {positive ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
                        </span>

                        {/* Sensitivity Q/N/L */}
                        <span
                          style={{ display: 'flex', alignItems: 'center', gap: '1px', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {(['quiet', 'normal', 'loud'] as const).map(level => {
                            const active = (item.sensitivity ?? 'normal') === level
                            return (
                              <button
                                key={level}
                                type="button"
                                title={level}
                                onClick={async e => {
                                  e.stopPropagation()
                                  await api.patch(`/watchlist/${item.symbol}/sensitivity`, { sensitivity: level })
                                }}
                                style={{
                                  border: 'none', cursor: 'pointer',
                                  padding: '0.15rem 0.3rem', fontSize: '0.6rem', fontWeight: active ? 700 : 400,
                                  background: active ? 'var(--attention-bg, rgba(184,134,43,0.18))' : 'transparent',
                                  color: active ? 'var(--attention, #B8862B)' : 'var(--text-muted)',
                                  transition: 'background 120ms, color 120ms',
                                }}
                              >
                                {level[0].toUpperCase()}
                              </button>
                            )
                          })}
                        </span>
                      </div>
                    )
                  })}

                  {/* Inline stock chips — Pulse style */}
                  <div style={{
                    padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
                  }}>
                    {brief.map(item => {
                      const positive = (item.price_change_pct ?? 0) >= 0
                      return (
                        <span
                          key={item.symbol}
                          style={{
                            fontFamily: 'var(--mono)', fontSize: '0.72rem', fontWeight: 600,
                            padding: '0.2rem 0.5rem', borderRadius: '4px',
                            background: positive ? 'rgba(0,179,134,0.08)' : 'rgba(239,68,68,0.08)',
                            color: positive ? 'var(--green)' : 'var(--red)',
                          }}
                        >
                          {item.symbol.replace('.NS', '')} {positive ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.25rem' }}>
                  <Link to="/watchlist" style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none', fontSize: '0.82rem' }}>
                    Manage watchlist →
                  </Link>
                  <Link to="/journal" style={{ color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'none', fontSize: '0.82rem' }}>
                    Decision journal →
                  </Link>
                </div>
              </div>
            )}

            {/* Empty watchlist */}
            {!loading && stockCount === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  Your watchlist is empty
                </p>
                <Link to="/watchlist" style={{
                  display: 'inline-block', background: 'var(--brand)', color: 'white',
                  padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 600, textDecoration: 'none',
                }}>
                  Add your first stock →
                </Link>
              </div>
            )}
          </>
        )}

        {now && null}
      </main>

      <StockDetail isOpen={deckItem !== null} onClose={() => setDeckItem(null)} item={deckItem} />
    </div>
  )
}
