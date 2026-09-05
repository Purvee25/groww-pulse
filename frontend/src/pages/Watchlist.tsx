import { useState } from 'react'
import { NavBar } from '../components/NavBar'
import { AttentionDeck } from '../components/AttentionDeck'
import { StockDetail, type BriefItem } from '../components/StockDetail'
import { AddSymbol } from '../components/AddSymbol'
import { PortfolioRisk } from '../components/PortfolioRisk'
import { useLiveBrief, formatLastChecked } from '../hooks/useWatchlist'
import api from '../lib/api'

type Tab = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'

const PRIORITY_DOT: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#6b7280',
}

export function Watchlist() {
  const { brief, loading, marking, stockCount, lastChecked, handleMarkCaughtUp, wsConnected } = useLiveBrief(null)
  const [tab, setTab] = useState<Tab>('ALL')
  const [deckItem, setDeckItem] = useState<BriefItem | null>(null)
  const [showRisk, setShowRisk] = useState(false)

  const removeSymbol = async (symbol: string) => {
    try { await api.delete(`/watchlist/${symbol}`) } catch {}
  }

  const rows = tab === 'ALL' ? brief : brief.filter(b => b.priority === tab)
  const worthALook = brief.filter(b => b.priority === 'HIGH' || b.priority === 'MEDIUM')
  const counts: Record<Tab, number> = {
    ALL: brief.length,
    HIGH: brief.filter(b => b.priority === 'HIGH').length,
    MEDIUM: brief.filter(b => b.priority === 'MEDIUM').length,
    LOW: brief.filter(b => b.priority === 'LOW').length,
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      <StockDetail isOpen={deckItem !== null} onClose={() => setDeckItem(null)} item={deckItem} />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
              Smart Watchlist
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {stockCount} stock{stockCount !== 1 ? 's' : ''} tracked · Last checked {formatLastChecked(lastChecked)}
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.68rem', fontWeight: 700,
                padding: '0.15rem 0.4rem', borderRadius: '999px',
                background: wsConnected ? 'rgba(0,179,134,0.12)' : 'rgba(245,158,11,0.12)',
                color: wsConnected ? 'var(--green)' : 'var(--amber)',
              }}>
                {wsConnected ? '● Live' : '○ Polling'}
              </span>
            </p>
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
            }}
          >
            {marking ? 'Saving…' : worthALook.length > 0 ? `Mark ${worthALook.length} as caught up` : '✓ All caught up'}
          </button>
        </div>

        {/* Attention Deck — narrative cards for flagged stocks */}
        {!loading && worthALook.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <AttentionDeck items={worthALook} onRefresh={handleMarkCaughtUp} refreshing={marking} />
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.5rem 1rem', fontSize: '0.8rem',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
              {t} {counts[t] > 0 && <span style={{ fontSize: '0.68rem', marginLeft: '0.2rem' }}>({counts[t]})</span>}
            </button>
          ))}
        </div>

        {/* Stock table */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 70px 32px',
            padding: '0.5rem 1.25rem', borderBottom: '1px solid var(--border)',
          }}>
            {['Stock', 'Price', 'Change', 'Signal', ''].map(h => (
              <span key={h} style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
            ))}
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{
                height: '58px', borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(90deg, var(--border) 25%, var(--surface-hover) 50%, var(--border) 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease infinite',
              }} />
            ))
          ) : rows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {tab === 'ALL' ? 'No stocks yet — add one below.' : `No ${tab.toLowerCase()} priority stocks.`}
            </div>
          ) : rows.map((item, i) => {
            const positive = (item.price_change_pct ?? 0) >= 0
            return (
              <div key={item.symbol} onClick={() => setDeckItem(item)} style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 70px 32px',
                alignItems: 'center', padding: '0.75rem 1.25rem',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', transition: 'background 120ms',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700,
                    background: 'linear-gradient(145deg, rgba(0,179,134,0.15), rgba(0,179,134,0.05))',
                    border: '1px solid rgba(0,179,134,0.2)', color: 'var(--brand)',
                  }}>{item.symbol[0]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.symbol.replace('.NS', '')}</span>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PRIORITY_DOT[item.priority] }} />
                      {/* Sensitivity chip */}
                      <span style={{ display: 'flex', gap: '1px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        {(['quiet', 'normal', 'loud'] as const).map(level => {
                          const active = (item.sensitivity ?? 'normal') === level
                          return (
                            <button key={level} type="button" title={level}
                              onClick={async e => { e.stopPropagation(); await api.patch(`/watchlist/${item.symbol}/sensitivity`, { sensitivity: level }) }}
                              style={{
                                border: 'none', cursor: 'pointer',
                                padding: '0.1rem 0.25rem', fontSize: '0.55rem', fontWeight: active ? 700 : 400,
                                background: active ? 'rgba(184,134,43,0.18)' : 'transparent',
                                color: active ? 'var(--attention, #B8862B)' : 'var(--text-muted)',
                              }}
                            >{level[0].toUpperCase()}</button>
                          )
                        })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.company_name}
                    </p>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 700 }}>₹{item.price.toFixed(2)}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 600, color: positive ? 'var(--green)' : 'var(--red)' }}>
                  {positive ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: item.priority === 'HIGH' ? 'var(--red)' : item.priority === 'MEDIUM' ? 'var(--attention, #B8862B)' : 'var(--text-muted)' }}>
                  {item.priority}
                </span>
                <button title="Remove" onClick={e => { e.stopPropagation(); removeSymbol(item.symbol) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem', lineHeight: 1,
                }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--red)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)')}
                >×</button>
              </div>
            )
          })}
        </div>

        {/* Add stock */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Add stock to watchlist
          </p>
          <AddSymbol />
        </div>

        {/* Portfolio risk — collapsible */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', overflow: 'hidden',
        }}>
          <button onClick={() => setShowRisk(r => !r)} style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '1rem 1.25rem', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text)',
          }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Portfolio Risk Analysis</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transition: 'transform 200ms' }}>
              {showRisk ? '▲' : '▼'}
            </span>
          </button>
          {showRisk && (
            <div style={{ padding: '0 1.25rem 1.25rem' }}>
              <PortfolioRisk />
            </div>
          )}
        </div>

        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </main>
    </div>
  )
}
