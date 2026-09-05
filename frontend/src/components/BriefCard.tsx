import { useState, useEffect } from 'react'
import { StockDetail, type BriefItem } from './StockDetail'
import { Sparkline } from './Sparkline'
import { RangeBar } from './RangeBar'
import api from '../lib/api'

interface CheckpointHistoryRow {
  id: number
  symbol: string
  price: number
  attention_score: number | null
  checkpoint_at: string
}

interface SymbolMetadata {
  symbol: string
  company_name: string
  sector?: string
  logo_url?: string
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  HIGH: { bg: 'var(--high-bg)', text: 'var(--high)', dot: '#EF4444' },
  MEDIUM: { bg: 'var(--medium-bg)', text: 'var(--medium)', dot: '#F59E0B' },
  LOW: { bg: 'var(--low-bg)', text: 'var(--low)', dot: '#10B981' },
}

// Depth cue: how much a card visually "stands forward" scales with attention,
// so the ranking is legible at a glance, not just a number in the corner.
// Rest-state shadow + a slightly taller lift on hover for HIGH; LOW stays
// visually quiet. No 3D transforms — just shadow layering and translateY,
// so it degrades to a plain flat card with zero risk if anything's off.
const DEPTH: Record<string, { restShadow: string; hoverShadow: string; hoverLift: string; accent: string }> = {
  HIGH: {
    restShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 20px -6px rgba(239,68,68,0.18)',
    hoverShadow: '0 2px 4px rgba(0,0,0,0.06), 0 16px 32px -8px rgba(239,68,68,0.28)',
    hoverLift: '-4px',
    accent: '#EF4444',
  },
  MEDIUM: {
    restShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px -6px rgba(245,158,11,0.14)',
    hoverShadow: '0 2px 4px rgba(0,0,0,0.05), 0 10px 20px -8px rgba(245,158,11,0.2)',
    hoverLift: '-2px',
    accent: '#F59E0B',
  },
  LOW: {
    restShadow: 'var(--shadow-sm)',
    hoverShadow: 'var(--shadow-sm)',
    hoverLift: '0px',
    accent: 'transparent',
  },
}

const FRESHNESS_COLORS: Record<string, string> = {
  live: '#10B981',
  delayed: '#F59E0B',
  stale: '#EF4444',
}

export function BriefCard({ item }: { item: BriefItem }) {
  const [showDetail, setShowDetail] = useState(false)
  const [thesisEditMode, setThesisEditMode] = useState(false)
  const [metadata, setMetadata] = useState<SymbolMetadata | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<CheckpointHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const priorityColor = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.LOW
  const depth = DEPTH[item.priority] || DEPTH.LOW

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await api.get(`/markets/symbol-metadata/${item.symbol}`)
        setMetadata(response.data)
      } catch (error) {
        console.error('Failed to fetch metadata:', error)
      }
    }
    fetchMetadata()
  }, [item.symbol])

  const loadHistory = async () => {
    if (historyLoading) return
    setHistoryLoading(true)
    try {
      const res = await api.get(`/watchlist/${item.symbol}/checkpoint-history?limit=8`)
      setHistory(res.data)
    } catch { /* not critical */ }
    finally { setHistoryLoading(false) }
  }

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) loadHistory()
    setShowHistory(v => !v)
  }

  return (
    <>
      <StockDetail
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setThesisEditMode(false) }}
        item={item}
        startInThesisEdit={thesisEditMode}
      />
    <div className="animate-entry" style={{
      position: 'relative',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.75rem',
      padding: '1.5rem',
      paddingLeft: item.priority !== 'LOW' ? '1.75rem' : '1.5rem',
      boxShadow: depth.restShadow,
      transform: 'translateY(0)',
      transition: 'border-color 200ms var(--ease-out), background 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out)',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = 'var(--border-light)'
      el.style.background = 'var(--surface-hover)'
      el.style.boxShadow = depth.hoverShadow
      el.style.transform = `translateY(${depth.hoverLift})`
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLElement
      el.style.borderColor = 'var(--border)'
      el.style.background = 'var(--surface)'
      el.style.boxShadow = depth.restShadow
      el.style.transform = 'translateY(0)'
    }}
    >
      {/* Attention accent bar — thicker/brighter for higher priority, invisible for LOW */}
      {item.priority !== 'LOW' && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: '0.75rem',
          bottom: '0.75rem',
          width: '3px',
          borderRadius: '2px',
          background: depth.accent,
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
        <div style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          {metadata?.logo_url && !logoFailed ? (
            <img
              src={metadata.logo_url}
              alt={metadata.company_name}
              style={{ width: '40px', height: '40px', borderRadius: '0.5rem', objectFit: 'cover' }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '0.5rem',
              background: `linear-gradient(135deg, ${depth.accent !== 'transparent' ? depth.accent : 'var(--brand)'}, color-mix(in srgb, ${depth.accent !== 'transparent' ? depth.accent : 'var(--brand)'} 60%, black))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'white',
              fontWeight: 700,
              fontSize: '1.05rem',
              fontFamily: 'var(--mono)',
            }}>
              {item.symbol.replace('.NS', '').charAt(0)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--brand)' }}>
                {item.symbol.replace('.NS', '')}
              </h3>
              {metadata?.sector && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.5rem',
                  background: 'var(--info-bg)',
                  color: 'var(--info)',
                  borderRadius: '0.25rem',
                  fontWeight: 600
                }}>
                  {metadata.sector}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              {metadata?.company_name || item.company_name}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {item.sector_adjusted && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.45rem',
              borderRadius: '0.3rem', letterSpacing: '0.4px',
              background: 'rgba(83,103,255,0.12)', color: 'var(--brand)',
              whiteSpace: 'nowrap',
            }}>
              sector-adj
            </span>
          )}
          <div style={{
            background: priorityColor.bg,
            color: priorityColor.text,
            padding: '0.5rem 0.75rem',
            borderRadius: '1rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: priorityColor.dot
            }} />
            {Math.round(item.attention_score)} Attention
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="brief-card-price-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
          <p style={{
            fontSize: '2rem',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            margin: 0,
            color: (item.price_change_pct ?? 0) >= 0 ? 'var(--success)' : 'var(--error)'
          }}>
            {(item.price_change_pct ?? 0) > 0 ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>since checkpoint</p>
        </div>
        <div className="brief-card-charts" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Sparkline symbol={item.symbol} />
          {item.week_52_high != null && item.week_52_low != null && (
            <RangeBar low={item.week_52_low} high={item.week_52_high} current={item.price} />
          )}
        </div>
      </div>

      {/* Narration */}
      <p style={{
        fontSize: '0.95rem',
        color: 'var(--text-secondary)',
        margin: '0 0 1rem 0',
        lineHeight: 1.6
      }}>
        {item.narration}
      </p>

      {/* Thesis */}
      {item.thesis_note && (
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          margin: '0 0 1rem 0',
          paddingLeft: '1rem',
          borderLeft: '2px solid var(--border-light)'
        }}>
          "{item.thesis_note}"
        </p>
      )}

      {/* Freshness & Market State */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border)'
      }}>
        <p style={{
          fontSize: '0.75rem',
          color: FRESHNESS_COLORS[item.freshness] || 'var(--text-muted)',
          margin: 0,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {item.market_state === 'closed' ? 'Market Closed' : item.freshness}
        </p>
      </div>

      {/* Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={() => { setThesisEditMode(false); setShowDetail(true) }}
          style={{
            background: 'transparent',
            color: 'var(--brand)',
            border: '1px solid var(--brand)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '36px',
            transition: 'all 200ms var(--ease-out)'
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'var(--info-bg)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
          }}
        >
          View
        </button>
        <button
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: '36px',
            transition: 'all 200ms var(--ease-out)'
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border-light)'
            el.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = 'var(--border)'
            el.style.color = 'var(--text-secondary)'
          }}
          onClick={() => { setThesisEditMode(true); setShowDetail(true) }}
        >
          {item.thesis_note ? 'Edit thesis' : 'Add thesis'}
        </button>

        {!item.is_first_visit && (
          <button
            onClick={toggleHistory}
            style={{
              background: 'transparent',
              color: showHistory ? 'var(--brand)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: '36px',
              transition: 'all 200ms var(--ease-out)',
            }}
          >
            {showHistory ? '▲ History' : '⏱ History'}
          </button>
        )}
      </div>

      {/* Checkpoint history panel — grid-template-rows collapse avoids max-height
          layout thrash; the inner div carries actual padding so rows:0fr clips it */}
      <div style={{
        display: 'grid',
        gridTemplateRows: showHistory ? '1fr' : '0fr',
        transition: 'grid-template-rows 280ms cubic-bezier(0.23,1,0.32,1)',
        marginTop: showHistory ? '0.75rem' : 0,
      }}>
      <div style={{ overflow: 'hidden' }}>
        {historyLoading ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
        ) : history.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            No checkpoints yet. Hit "Mark as Caught Up" to record one.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {history.map(row => {
              const d = new Date(row.checkpoint_at)
              const label = d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              const daysAgo = Math.round((Date.now() - d.getTime()) / 86400000)
              return (
                <div key={row.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.4rem 0.75rem',
                  background: 'var(--surface-2, rgba(255,255,255,0.03))',
                  borderRadius: '0.4rem',
                  fontSize: '0.8rem',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>₹{row.price.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  )
}
