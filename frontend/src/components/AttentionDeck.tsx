import { useEffect, useRef, useState } from 'react'
import type { BriefItem } from './StockDetail'
import { Sparkline } from './Sparkline'
import { RangeBar } from './RangeBar'

const STEP_ROT = 13
const NARROW_BP = 560

function moveLabel(z: number | null): string {
  if (z === null) return 'New'
  const a = Math.abs(z)
  return a >= 3 ? 'Very unusual' : a >= 2 ? 'Unusual move' : 'Bigger than usual'
}

function layoutFor(w: number) {
  const narrow = w > 0 && w < NARROW_BP
  if (narrow) {
    const cw = Math.max(200, Math.min(280, w - 48))
    return {
      compact:  { cardW: Math.round(cw * 0.62), cardH: 128, stepX: Math.round(cw * 0.22), stepZ: 40, anchor: '50%', stageH: 196, cardTop: -64 },
      expanded: { cardW: cw,                    cardH: 244, stepX: Math.round(cw * 0.34), stepZ: 70, anchor: '50%', stageH: 400, cardTop: -150 },
    }
  }
  return {
    compact:  { cardW: 178, cardH: 120, stepX: 78,  stepZ: 60,  anchor: '42%', stageH: 184, cardTop: -60 },
    expanded: { cardW: 300, cardH: 244, stepX: 132, stepZ: 108, anchor: '42%', stageH: 372, cardTop: -140 },
  }
}

interface Props {
  items: BriefItem[]
  onRefresh?: () => void
  refreshing?: boolean
}

export function AttentionDeck({ items, onRefresh, refreshing }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [flat, setFlat] = useState(false)
  const [layout, setLayout] = useState(() => layoutFor(0))

  // ResizeObserver — switches between wide/narrow layouts
  useEffect(() => {
    const node = stage.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setLayout(layoutFor(entry.contentRect.width)))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setFlat(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Refs for wheel handler closure
  const activeRef = useRef(0)
  const expandedRef = useRef(false)
  const countRef = useRef(0)
  const wheelLock = useRef(0)
  useEffect(() => {
    activeRef.current = active
    expandedRef.current = expanded
    countRef.current = items.length
  }, [active, expanded, items.length])

  // Non-passive wheel so we can preventDefault
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) return
      const delta = e.deltaX
      if (Math.abs(delta) < 4) return
      const next = delta > 0 ? activeRef.current + 1 : activeRef.current - 1
      if (next < 0 || next > countRef.current - 1) return
      e.preventDefault()
      const now = Date.now()
      if (now - wheelLock.current < 260) return
      wheelLock.current = now
      setActive(next)
      setExpanded(true)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  // Snap to front when ranking changes
  const deckKey = items.map((i) => i.symbol).join(',')
  const [seenKey, setSeenKey] = useState(deckKey)
  if (deckKey !== seenKey) {
    setSeenKey(deckKey)
    setActive(0)
    setExpanded(true)
  }

  if (items.length === 0) return null

  const dims = expanded ? layout.expanded : layout.compact

  const onMove = (e: React.MouseEvent) => {
    if (flat) return
    const r = stage.current?.getBoundingClientRect()
    if (!r) return
    setParallax({
      x: ((e.clientY - r.top)  / r.height - 0.5) * -7,
      y: ((e.clientX - r.left) / r.width  - 0.5) *  16,
    })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); setExpanded(true) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); setExpanded(true) }
    if (e.key === 'Escape' && expanded) { e.preventDefault(); setExpanded(false) }
  }

  // Touch
  const touchX = useRef<number | null>(null)
  const touchTime = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    touchX.current = e.touches[0].clientX
    touchTime.current = Date.now()
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const diff = touchX.current - e.changedTouches[0].clientX
    const dur = Date.now() - touchTime.current
    touchX.current = null
    if (Math.abs(diff) > 40 && dur < 600) {
      setActive((a) => diff > 0 ? Math.min(items.length - 1, a + 1) : Math.max(0, a - 1))
      setExpanded(true)
    }
  }

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Zone header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
          {items.length} worth a look — closest deserves attention
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          click · wheel · arrow keys
        </p>
      </div>

      {/* Stage */}
      <div
        ref={stage}
        tabIndex={-1}
        onMouseMove={onMove}
        onMouseLeave={() => setParallax({ x: 0, y: 0 })}
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          height: expanded ? dims.stageH + 80 : dims.stageH,
          perspective: 1500,
          perspectiveOrigin: `${dims.anchor} 42%`,
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          outline: 'none',
          touchAction: 'pan-y',
          background: `
            radial-gradient(120% 90% at 22% 0%, rgba(16,185,129,0.04), transparent 58%),
            linear-gradient(175deg, var(--surface-2, var(--surface)), var(--surface))
          `,
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        }}
      >
        {/* Fade gradient at bottom */}
        <div aria-hidden="true" style={{
          pointerEvents: 'none',
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, var(--surface) 0%, transparent 30%)',
          zIndex: 5,
        }} />

        {/* Refresh button */}
        {onRefresh && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRefresh() }}
            disabled={refreshing}
            aria-label="Reset baseline"
            style={{
              position: 'absolute', right: '0.875rem', top: '0.875rem', zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--surface-3, var(--surface))',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer',
              opacity: refreshing ? 0.4 : 1,
              transition: 'opacity 150ms',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={refreshing ? { animation: 'spin 0.7s linear infinite' } : undefined}>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.89M13.5 2v3.5H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* 3D container */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: dims.anchor,
          transformStyle: 'preserve-3d',
          transform: flat
            ? 'translate(-50%,-50%)'
            : `translate(-50%,-46%) rotateX(${6 + parallax.x}deg) rotateY(${-9 + parallax.y * 0.35}deg)`,
          transition: 'transform 0.42s cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          {items.map((item, index) => {
            const depth = index - active
            const behind = Math.abs(depth)
            const isFront = depth === 0

            const zScore = item.attention_score > 0 ? item.attention_score / 15 : null
            const positive = (item.price_change_pct ?? 0) >= 0
            const magnitude = Math.min(1, Math.abs(item.attention_score) / 80)
            const rim = 0.08 + magnitude * 0.25

            const dim = isFront ? 1 : Math.max(0.3, 1 - behind * 0.26)

            const transform = flat
              ? `translateX(${depth * 18}px) scale(${isFront ? 1 : 0.94})`
              : expanded
                ? isFront
                  ? 'translate3d(0px,-62px,40px) rotateY(0deg) scale(1)'
                  : `translate3d(${depth * (dims.stepX + 26)}px, ${behind * 9}px, ${-behind * dims.stepZ - 90}px) rotateY(${depth * -STEP_ROT}deg) scale(${0.92 - behind * 0.03})`
                : `translate3d(${depth * dims.stepX}px, ${behind * 9}px, ${-behind * dims.stepZ}px) rotateY(${depth * -STEP_ROT}deg) scale(${1 - behind * 0.03})`

            const glowColor = `rgba(16,185,129,${rim * 0.4})`

            return (
              <article
                key={item.symbol}
                role="button"
                tabIndex={isFront ? 0 : -1}
                aria-current={isFront || undefined}
                aria-expanded={isFront ? expanded : undefined}
                aria-label={isFront ? `${item.symbol}: ${item.narration}. Click to expand.` : `Bring ${item.symbol} to front`}
                onClick={() => isFront ? setExpanded((o) => !o) : (setActive(index), setExpanded(true))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    isFront ? setExpanded((o) => !o) : setActive(index)
                  }
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  marginLeft: -dims.cardW / 2,
                  marginTop: dims.cardTop,
                  width: dims.cardW,
                  zIndex: 100 - behind,
                  opacity: behind > 3 ? 0 : expanded && !isFront ? dim * 0.35 : dim,
                  pointerEvents: behind > 3 ? 'none' : 'auto',
                  cursor: 'pointer',
                  borderRadius: '16px',
                  padding: '1px',
                  transformStyle: 'preserve-3d',
                  transform,
                  transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease',
                  background: `linear-gradient(150deg, rgba(16,185,129,${rim}), var(--border, rgba(255,255,255,0.08)) 45%, var(--border-light, rgba(255,255,255,0.04)) 100%)`,
                  boxShadow: isFront
                    ? `0 42px 70px -28px rgba(0,0,0,0.18), 0 0 60px -18px ${glowColor}`
                    : '0 30px 54px -30px rgba(0,0,0,0.15)',
                  filter: isFront ? 'none' : `saturate(${1 - behind * 0.18}) blur(${behind * 0.6}px)`,
                }}
              >
                {/* Card inner */}
                <div style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '15px',
                  padding: expanded ? '1.25rem' : '0.85rem',
                  minHeight: dims.cardH,
                  background: 'linear-gradient(168deg, var(--surface-2, var(--surface)), var(--surface))',
                  transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
                }}>
                  {/* Glass sheen */}
                  <span aria-hidden="true" style={{
                    pointerEvents: 'none', position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 42%)',
                    borderRadius: '15px',
                  }} />
                  {/* Glow orb */}
                  <span aria-hidden="true" style={{
                    pointerEvents: 'none',
                    position: 'absolute', right: '-2.5rem', top: '-3rem',
                    width: '8rem', height: '8rem', borderRadius: '50%',
                    filter: 'blur(28px)',
                    background: `rgba(16,185,129,${0.04 + magnitude * 0.12})`,
                  }} />

                  {!expanded ? (
                    /* ── COMPACT STATE ── */
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* Avatar */}
                        <span style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '28px', height: '28px', borderRadius: '8px',
                          fontSize: '11px', fontWeight: 600,
                          background: 'linear-gradient(145deg, var(--surface-3, var(--surface-hover)), var(--surface))',
                          border: '1px solid var(--border)',
                        }}>
                          {item.symbol[0]}
                        </span>
                        {/* Rank badge */}
                        <span style={{
                          background: 'var(--attention-bg, rgba(184,134,43,0.12))',
                          color: 'var(--attention, #B8862B)',
                          padding: '0.2rem 0.5rem', borderRadius: '999px',
                          fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          #{index + 1}
                        </span>
                      </div>

                      <div>
                        <h3 style={{ margin: '0.35rem 0 0.25rem', fontSize: '13px', fontWeight: 600, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.symbol.replace('.NS', '')}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600 }}>
                            ₹{item.price.toFixed(0)}
                          </span>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '9.5px', fontWeight: 600, whiteSpace: 'nowrap',
                            color: positive ? 'var(--green)' : 'var(--red)',
                            background: positive ? 'rgba(0,179,134,0.13)' : 'rgba(220,38,38,0.13)',
                          }}>
                            {positive ? '▲' : '▼'} {moveLabel(zScore)}
                          </span>
                        </div>
                        {item.quiet_for_ms != null && item.quiet_for_ms > 0 && (
                          <span style={{
                            display: 'inline-block', marginTop: '0.2rem',
                            fontSize: '8.5px', color: 'var(--text-muted)',
                            background: 'var(--border-light, rgba(255,255,255,0.04))',
                            border: '1px solid var(--border)',
                            borderRadius: '4px', padding: '0.1rem 0.35rem',
                          }}>
                            quiet {Math.round(item.quiet_for_ms / 86_400_000)}d
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── EXPANDED STATE ── */
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '40px', height: '40px', borderRadius: '12px',
                          fontSize: '15px', fontWeight: 600,
                          background: 'linear-gradient(145deg, var(--surface-3, var(--surface-hover)), var(--surface))',
                          border: '1px solid var(--border)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                        }}>
                          {item.symbol[0]}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem' }}>
                          <span style={{
                            background: 'var(--attention-bg, rgba(184,134,43,0.12))',
                            color: 'var(--attention, #B8862B)',
                            padding: '0.25rem 0.5rem', borderRadius: '999px',
                            fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            #{index + 1} · {Math.round(item.attention_score)}
                          </span>
                          {item.sector_adjusted && (
                            <span style={{
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)', padding: '0.15rem 0.4rem',
                              borderRadius: '999px', fontSize: '9px',
                            }}>
                              sector-adj
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 style={{ margin: '0 0 0.125rem', fontSize: '17px', fontWeight: 600, letterSpacing: '-0.3px' }}>
                        {item.symbol.replace('.NS', '')}
                      </h3>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.company_name}
                      </p>

                      {isFront && (
                        <p style={{
                          margin: '0 0 0.75rem',
                          fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)',
                          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          minHeight: '3.5em',
                        }}>
                          {item.quiet_for_ms != null && item.quiet_for_ms > 86_400_000 && (
                            <span style={{ color: 'var(--attention, #B8862B)', fontWeight: 600 }}>
                              Quiet {Math.round(item.quiet_for_ms / 86_400_000)}d, now:{' '}
                            </span>
                          )}
                          {item.narration}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', marginBottom: isFront ? '0.875rem' : 0 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '19px', fontWeight: 600, letterSpacing: '-0.3px' }}>
                          ₹{item.price.toFixed(2)}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: '0.375rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem', borderRadius: '999px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
                            color: positive ? 'var(--green)' : 'var(--red)',
                            background: positive ? 'rgba(0,179,134,0.13)' : 'rgba(220,38,38,0.13)',
                          }}>
                            {positive ? '▲' : '▼'} {moveLabel(zScore)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            {item.attention_score > 0 ? `${(item.attention_score / 15).toFixed(1)}σ` : ''}
                          </span>
                          {item.regime === 'HIGH_VOLATILITY_EXPANSION' && (
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--error)', background: 'var(--error-bg)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              VIX EXPANSION
                            </span>
                          )}
                        </div>
                      </div>

                      {isFront && (
                        <ExpandedDetail item={item} />
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* Prev/Next buttons */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive((a) => Math.max(0, a - 1)); setExpanded(true) }}
              disabled={active === 0}
              aria-label="Previous"
              style={{
                position: 'absolute', left: '0.5rem', top: '50%', zIndex: 20,
                transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                opacity: active === 0 ? 0 : 1, transition: 'opacity 200ms',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive((a) => Math.min(items.length - 1, a + 1)); setExpanded(true) }}
              disabled={active >= items.length - 1}
              aria-label="Next"
              style={{
                position: 'absolute', right: '0.5rem', top: '50%', zIndex: 20,
                transform: 'translateY(-50%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                opacity: active >= items.length - 1 ? 0 : 1, transition: 'opacity 200ms',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        )}

        {/* Dot nav */}
        {items.length > 1 && (
          <div style={{
            position: 'absolute', bottom: '0.875rem', left: '50%',
            transform: 'translateX(-50%)', zIndex: 20,
            display: 'flex', gap: '0.375rem', alignItems: 'center',
          }}>
            {items.map((_, i) => (
              <button
                key={i}
                aria-label={`Card ${i + 1}`}
                onClick={() => { setActive(i); setExpanded(true) }}
                style={{
                  height: '6px', borderRadius: '999px', border: 'none', cursor: 'pointer', padding: 0,
                  width: i === active ? '20px' : '6px',
                  background: i === active ? 'var(--attention, #B8862B)' : 'var(--border)',
                  transition: 'width 250ms var(--ease-out), background 250ms',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ExpandedDetail({ item }: { item: BriefItem }) {
  const positive = (item.price_change_pct ?? 0) >= 0

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <Sparkline symbol={item.symbol} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11.5px', fontWeight: 600, color: positive ? 'var(--green)' : 'var(--red)' }}>
          {(item.price_change_pct ?? 0) > 0 ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
        </span>
      </div>

      {item.week_52_high != null && item.week_52_low != null && (
        <div style={{ marginBottom: '0.75rem' }}>
          <RangeBar low={item.week_52_low} high={item.week_52_high} current={item.price} label="52-week" />
        </div>
      )}

      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '11px' }}>
        {item.volume != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Volume</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {item.volume >= 1e5 ? `${(item.volume / 1e5).toFixed(1)}L` : item.volume.toLocaleString()}
            </dd>
          </div>
        )}
        {item.thesis_verdict && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.25rem' }}>
            <dt style={{ color: 'var(--text-muted)' }}>Thesis</dt>
            <dd style={{
              margin: 0, fontWeight: 700, fontSize: '10px',
              color: item.thesis_verdict === 'CHALLENGED' ? 'var(--error)' : item.thesis_verdict === 'SUPPORTED' ? 'var(--green)' : 'var(--text-muted)',
            }}>
              {item.thesis_verdict}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
