interface RangeBarProps {
  low: number
  high: number
  current: number
  label?: boolean
}

export function RangeBar({ low, high, current, label = true }: RangeBarProps) {
  const span = high - low
  const rawPct = span > 0 ? ((current - low) / span) * 100 : 50
  const pct = Math.min(98, Math.max(2, rawPct))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '90px' }}>
      <div style={{
        position: 'relative',
        height: '4px',
        borderRadius: '999px',
        background: 'var(--line-2, var(--border))',
      }}>
        <span style={{
          position: 'absolute',
          top: '50%',
          left: `${pct}%`,
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--accent, var(--brand))',
          boxShadow: '0 0 0 2px var(--surface)',
          transform: 'translate(-50%, -50%)',
        }} />
      </div>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.625rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--mono)',
        }}>
          <span>₹{low.toFixed(0)}</span>
          <span>₹{high.toFixed(0)}</span>
        </div>
      )}
    </div>
  )
}
