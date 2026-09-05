import { useEffect, useState } from 'react'
import api from '../lib/api'

interface MarketIndex {
  name: string
  price: number
  change_pct: number
}

interface RailTickerItem {
  label: string
  price: number
  change_pct: number
}

const PINNED_ORDER = ['NIFTY 50', 'NIFTY']

/** Two-part market rail: NIFTY (with a live pulse dot) plus a couple of
 * correlated indices pinned to the left and never scrolling, and the
 * user's own watchlist symbols scrolling as a marquee on the right.
 * Only NIFTY's price/% comes straight from the backend index feed — any
 * other index shown here is real data from that same feed, not derived. */
export function MarketRail({ items }: { items: RailTickerItem[] }) {
  const [indices, setIndices] = useState<MarketIndex[]>([])

  useEffect(() => {
    const load = () => {
      api.get('/markets/indices')
        .then((res) => setIndices(res.data.indices || []))
        .catch((error) => console.error('Failed to fetch indices for rail:', error))
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (indices.length === 0 && items.length === 0) return null

  const nifty = indices.find((i) => PINNED_ORDER.some((n) => i.name.toUpperCase().includes(n)))
  const otherIndices = indices.filter((i) => i !== nifty).slice(0, 2)
  const pinned = [nifty, ...otherIndices].filter(Boolean) as MarketIndex[]

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      {/* Pinned: NIFTY + a couple of correlated indices, never scrolls */}
      {pinned.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          padding: '0.6rem 1rem 0.6rem 1.25rem',
          gap: '1.25rem',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-hover)',
        }}>
          {pinned.map((idx, i) => (
            <div
              key={idx.name}
              className={i > 0 ? 'market-rail-pinned-extra' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              {i === 0 && (
                <span
                  className="live-pulse"
                  style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }}
                />
              )}
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: i === 0 ? 'var(--text)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}>
                {idx.name}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                {idx.price.toFixed(2)}
              </span>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap',
                color: idx.change_pct >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {idx.change_pct > 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scrolling: watchlist symbols only */}
      {items.length > 0 && (
        <div className="market-rail-marquee-mask" style={{ flex: 1, overflow: 'hidden', padding: '0.6rem 0', minWidth: 0, WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 3rem, black calc(100% - 2rem), transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0%, black 3rem, black calc(100% - 2rem), transparent 100%)' }}>
          <div className="marquee-track" style={{ animationDuration: `${Math.max(items.length * 4, 18)}s` }}>
            {[...items, ...items].map((t, i) => (
              <div key={`${t.label}-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0 1.25rem',
                whiteSpace: 'nowrap',
                borderRight: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{t.label}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>{t.price.toFixed(2)}</span>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  fontFamily: 'var(--mono)',
                  color: t.change_pct >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {t.change_pct > 0 ? '+' : ''}{t.change_pct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .market-rail-pinned-extra { display: none !important; }
        }
      `}</style>
    </div>
  )
}
