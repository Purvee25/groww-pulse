import { useEffect, useState } from 'react'
import api from '../lib/api'

interface PricePoint {
  price: number
  fetched_at: string
}

const WIDTH = 100
const HEIGHT = 24

/** Pure-SVG sparkline — no charting library. Normalizes recent prices into
 * a fixed viewBox and draws a single polyline; color follows the net
 * direction over the fetched window, not the per-tick wiggle. */
export function Sparkline({ symbol }: { symbol: string }) {
  const [points, setPoints] = useState<PricePoint[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get(`/watchlist/${symbol}/history`, { params: { points: 20 } })
      .then((res) => { if (!cancelled) setPoints(res.data.points || []) })
      .catch((error) => console.error('Failed to fetch sparkline history:', error))
    return () => { cancelled = true }
  }, [symbol])

  if (!points || points.length < 2) {
    return <span style={{ display: 'inline-block', width: WIDTH, height: HEIGHT }} />
  }

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const coords = prices.map((price, i) => {
    const x = (i / (prices.length - 1)) * WIDTH
    const y = HEIGHT - ((price - min) / range) * HEIGHT
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const direction = prices[prices.length - 1] - prices[0]
  const stroke = direction > 0 ? 'var(--green)' : direction < 0 ? 'var(--red)' : 'var(--text-muted)'

  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
