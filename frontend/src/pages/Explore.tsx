import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { NavBar } from '../components/NavBar'
import { MarketRail } from '../components/MarketRail'
import api from '../lib/api'

interface Mover { symbol: string; price: number; change_pct: number }
interface IndexData { name: string; price: number; change_pct: number }
interface WatchlistSpot { symbol: string; company_name: string; price: number; stock_return_pct: number; price_change_pct?: number; priority: string; narrative: string; why?: string }

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d={up ? 'M5 8V2M2 5l3-3 3 3' : 'M5 2v6M8 5L5 8 2 5'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function MoverCard({ item, type }: { item: Mover; type: 'gainer' | 'loser' }) {
  const positive = type === 'gainer'
  return (
    <div style={{
      padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', minWidth: '130px', flexShrink: 0,
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', marginBottom: '0.625rem',
        background: positive ? 'rgba(0,179,134,0.1)' : 'rgba(239,68,68,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700,
        color: positive ? 'var(--green)' : 'var(--red)',
      }}>
        {item.symbol[0]}
      </div>
      <p style={{ margin: '0 0 0.125rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
        {item.symbol}
      </p>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
        ₹{item.price.toFixed(2)}
      </p>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--mono)',
        color: positive ? 'var(--green)' : 'var(--red)',
      }}>
        <ArrowIcon up={positive} />
        {Math.abs(item.change_pct).toFixed(2)}%
      </span>
    </div>
  )
}

const INDEX_DISPLAY: Record<string, string> = {
  'NIFTY 50': 'NIFTY 50',
  'SENSEX': 'SENSEX',
  'NIFTY BANK': 'BANK NIFTY',
  'NIFTY MIDCAP 100': 'MIDCAP',
  'NIFTY IT': 'NIFTY IT',
}

export function Explore() {
  const [indices, setIndices] = useState<IndexData[]>([])
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers, setLosers] = useState<Mover[]>([])
  const [spotlight, setSpotlight] = useState<WatchlistSpot[]>([])
  const [hasStocks, setHasStocks] = useState(false)
  const [moversLoading, setMoversLoading] = useState(true)
  const [indicesLoading, setIndicesLoading] = useState(true)
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers')

  // Derive market-open status from IST clock (Mon–Fri 09:15–15:30)
  const isMarketOpen = (() => {
    const now = new Date()
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    const day = ist.getDay()
    const minutes = ist.getHours() * 60 + ist.getMinutes()
    return day >= 1 && day <= 5 && minutes >= 555 && minutes < 930 // 9:15–15:30
  })()

  useEffect(() => {
    api.get('/markets/indices').then(r => {
      setIndices(r.data.indices ?? [])
      setIndicesLoading(false)
    }).catch(() => setIndicesLoading(false))

    api.get('/markets/movers').then(r => {
      setGainers(r.data.gainers ?? [])
      setLosers(r.data.losers ?? [])
      setMoversLoading(false)
    }).catch(() => setMoversLoading(false))

    api.get('/watchlist').then(r => {
      const all: WatchlistSpot[] = r.data.stocks ?? []
      setHasStocks(all.length > 0)
      const items = all
        .filter((i: WatchlistSpot) => i.priority === 'HIGH' || i.priority === 'MEDIUM')
        .slice(0, 3)
      setSpotlight(items)
    }).catch(() => {})
  }, [])

  const railItems = indices.map(idx => ({
    label: Object.entries(INDEX_DISPLAY).find(([k]) => idx.name.includes(k))?.[1] ?? idx.name,
    price: idx.price,
    change_pct: idx.change_pct,
  }))

  const currentMovers = tab === 'gainers' ? gainers : losers

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      {railItems.length > 0 && <MarketRail items={railItems} />}

      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>

        {/* ── Index cards ── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '1px', background: 'var(--border)',
            border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden',
          }}>
            {indicesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 0 }} />
                ))
              : indices.slice(0, 5).map(idx => {
                  const positive = idx.change_pct >= 0
                  const label = Object.entries(INDEX_DISPLAY).find(([k]) => idx.name.includes(k))?.[1] ?? idx.name
                  return (
                    <div key={idx.name} style={{ background: 'var(--surface)', padding: '1rem 1.25rem' }}>
                      <p style={{ margin: '0 0 0.375rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                        {label}
                      </p>
                      <p style={{ margin: '0 0 0.125rem', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {idx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--mono)', color: positive ? 'var(--green)' : 'var(--red)' }}>
                        {positive ? '+' : ''}{idx.change_pct.toFixed(2)}%
                      </span>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="explore-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>

          {/* Left: Top movers */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Top movers today</h2>
              {/* Tab toggle */}
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                {(['gainers', 'losers'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    border: 'none', cursor: 'pointer',
                    padding: '0.3rem 0.875rem', fontSize: '0.78rem', fontWeight: tab === t ? 700 : 400,
                    background: tab === t ? 'var(--brand)' : 'var(--surface)',
                    color: tab === t ? 'white' : 'var(--text-muted)',
                    transition: 'background 150ms, color 150ms',
                    textTransform: 'capitalize',
                  }}>{t}</button>
                ))}
              </div>
            </div>

            {!isMarketOpen && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem',
                fontSize: '0.8rem', color: 'var(--text-muted)',
              }}>
                <span style={{ fontSize: '1rem' }}>🕐</span>
                <span>
                  <strong style={{ color: 'var(--text)' }}>NSE is closed.</strong>
                  {' '}Live movers and attention scores update Mon–Fri 9:15 am – 3:30 pm IST.
                  Prices shown are from the last trading session.
                </span>
              </div>
            )}
            {moversLoading ? (
              <div style={{ display: 'flex', gap: '0.75rem', overflow: 'hidden' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ width: '130px', height: '110px', borderRadius: '10px', flexShrink: 0 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {currentMovers.map(m => <MoverCard key={m.symbol} item={m} type={tab === 'gainers' ? 'gainer' : 'loser'} />)}
              </div>
            )}

            {/* Market overview table */}
            <div style={{ marginTop: '2rem' }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>Most active stocks</h2>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px',
                  padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)',
                }}>
                  {['Company', 'Price', 'Change', '1D Chart'].map(h => (
                    <span key={h} style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                  ))}
                </div>
                {[...gainers, ...losers].slice(0, 8).map((item, i, arr) => {
                  const positive = item.change_pct >= 0
                  return (
                    <div key={item.symbol} style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px',
                      alignItems: 'center', padding: '0.75rem 1.25rem',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700,
                          background: 'var(--surface-hover)', color: 'var(--brand)',
                        }}>{item.symbol[0]}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.symbol}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 700 }}>
                        ₹{item.price.toFixed(2)}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 700, color: positive ? 'var(--green)' : 'var(--red)' }}>
                        {positive ? '+' : ''}{item.change_pct.toFixed(2)}%
                      </span>
                      {/* Mini sparkline placeholder */}
                      <svg width="80" height="28" viewBox="0 0 80 28" fill="none" aria-hidden="true">
                        <polyline
                          points={positive
                            ? '0,20 16,18 32,14 48,10 64,8 80,4'
                            : '0,8 16,10 32,14 48,18 64,20 80,24'}
                          stroke={positive ? 'var(--green)' : 'var(--red)'}
                          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                        />
                      </svg>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right: Smart Watchlist spotlight */}
          <div>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', overflow: 'hidden', position: 'sticky', top: '72px',
            }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 0.125rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brand)' }}>
                  Smart Watchlist
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                  {spotlight.length > 0
                    ? `${spotlight.length} stock${spotlight.length > 1 ? 's' : ''} deserve attention`
                    : 'Your watchlist is quiet'}
                </p>
              </div>

              {spotlight.length > 0 ? (
                <>
                  {spotlight.map((item, i) => {
                    const positive = (item.stock_return_pct ?? 0) >= 0
                    const dotColor = item.priority === 'HIGH' ? 'var(--red)' : item.priority === 'MEDIUM' ? 'var(--attention, #B8862B)' : 'var(--border)'
                    return (
                      <div key={item.symbol} style={{
                        padding: '0.875rem 1.25rem',
                        borderBottom: i < spotlight.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.symbol.replace('.NS', '')}</span>
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'var(--mono)', color: positive ? 'var(--green)' : 'var(--red)' }}>
                            {positive ? '+' : ''}{(item.stock_return_pct ?? 0).toFixed(2)}%
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          {item.narrative}
                        </p>
                        {item.why && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
                            {item.why}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  <div style={{ padding: '0.875rem 1.25rem' }}>
                    <Link to="/watchlist" style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      background: 'var(--brand)', color: 'white',
                      padding: '0.6rem', borderRadius: '8px',
                      fontSize: '0.82rem', fontWeight: 600,
                    }}>
                      View smart watchlist →
                    </Link>
                  </div>
                </>
              ) : (
                <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Add stocks to your watchlist and we'll flag only what changed enough to matter — statistically.
                  </p>
                  <Link to="/watchlist" style={{
                    display: 'block', textDecoration: 'none',
                    background: 'var(--brand)', color: 'white',
                    padding: '0.6rem', borderRadius: '8px',
                    fontSize: '0.82rem', fontWeight: 600,
                  }}>
                    Create watchlist →
                  </Link>
                </div>
              )}
            </div>

            {/* What makes Pulse different — only shown to new users */}
            {!hasStocks && (
              <div style={{
                marginTop: '1rem',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '1rem 1.25rem',
              }}>
                <p style={{ margin: '0 0 0.625rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                  Why Pulse?
                </p>
                {[
                  { icon: '📊', text: 'Z-score scoring — flags moves unusual for that stock, not just large ones' },
                  { icon: '⏱', text: 'Remembers when you last checked — quiet → sudden move = bigger flag' },
                  { icon: '🎯', text: 'Sensitivity controls — tell Pulse if a stock is naturally volatile' },
                  { icon: '📓', text: 'Journal your thesis — see if the market proved you right' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', gap: '0.625rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', lineHeight: '1.5', flexShrink: 0 }}>{icon}</span>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
