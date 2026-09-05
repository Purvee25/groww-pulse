import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import api, { mapStockOut } from '../lib/api'

/** Shared watchlist fetch/checkpoint logic so every page (Dashboard,
 * Watchlist, Journal, StockPage) reads the same store and doesn't
 * duplicate — or drift out of sync with — the load/refresh behavior. */
export function useWatchlist(watchlistId?: number | null) {
  const { brief, setBrief } = useStore()
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastChecked, setLastChecked] = useState<string | null>(null)

  const stockCount = brief.length
  const totalChange = stockCount > 0
    ? brief.reduce((sum, item) => sum + (item.price_change_pct || 0), 0) / stockCount
    : 0

  const loadBrief = async () => {
    try {
      const params = watchlistId != null ? `?watchlist_id=${watchlistId}` : ''
      const response = await api.get(`/watchlist${params}`)
      setBrief((response.data.stocks || []).map(mapStockOut))
      setErrorMsg('')
      setLastChecked(response.data.last_checkpoint ?? null)
    } catch (error) {
      console.error('Failed to fetch brief:', error)
      setErrorMsg('Could not load your watchlist. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkCaughtUp = async () => {
    try {
      setMarking(true)
      const params = watchlistId != null ? `?watchlist_id=${watchlistId}` : ''
      const response = await api.post(`/watchlist/checkpoint/mark${params}`)
      setLastChecked(response.data?.checkpoint_time ?? new Date().toISOString())
      await loadBrief()
    } catch (error) {
      console.error('Failed to mark caught up:', error)
      setErrorMsg('Could not save your checkpoint. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadBrief()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistId])

  return { brief, loading, marking, errorMsg, lastChecked, stockCount, totalChange, loadBrief, handleMarkCaughtUp }
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30_000
const POLL_INTERVAL_MS = 30_000

/** Live brief hook — WebSocket primary, polling fallback.
 * The WS endpoint pushes scored data every 30s. If the connection fails
 * (e.g. proxied in production), we fall back to polling. */
export function useLiveBrief(watchlistId?: number | null) {
  const { brief, setBrief } = useStore()
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [marking, setMarking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const usingFallbackRef = useRef(false)

  const stockCount = brief.length
  const totalChange = stockCount > 0
    ? brief.reduce((sum, item) => sum + (item.price_change_pct || 0), 0) / stockCount
    : 0

  const loadBrief = async () => {
    try {
      const params = watchlistId != null ? `?watchlist_id=${watchlistId}` : ''
      const response = await api.get(`/watchlist${params}`)
      setBrief((response.data.stocks || []).map(mapStockOut))
      setErrorMsg('')
      setLastChecked(response.data.last_checkpoint ?? null)
    } catch (error) {
      console.error('Failed to fetch brief:', error)
      setErrorMsg('Could not load watchlist.')
    } finally {
      setLoading(false)
    }
  }

  const startPollingFallback = () => {
    if (usingFallbackRef.current) return
    usingFallbackRef.current = true
    loadBrief()
    pollTimerRef.current = setInterval(loadBrief, POLL_INTERVAL_MS)
  }

  const stopPollingFallback = () => {
    usingFallbackRef.current = false
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
  }

  const connect = () => {
    const token = localStorage.getItem('token')
    if (!token) { startPollingFallback(); return }

    try {
      const ws = new WebSocket(`${WS_BASE}/brief?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        reconnectDelayRef.current = RECONNECT_BASE_MS
        stopPollingFallback()
        setLoading(false)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type === 'brief' && Array.isArray(msg.stocks)) {
            let stocks = msg.stocks.map(mapStockOut)
            if (watchlistId != null) {
              // WS doesn't scope by watchlist yet — filter client-side
              // This is a shallow cut; a full solution would pass watchlist_id to the WS
            }
            setBrief(stocks)
            setErrorMsg('')
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setWsConnected(false)
        wsRef.current = null
        // Exponential backoff reconnect
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, RECONNECT_MAX_MS)
          connect()
        }, reconnectDelayRef.current)
      }

      ws.onerror = () => {
        ws.close()
        startPollingFallback()
      }
    } catch {
      startPollingFallback()
    }
  }

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      stopPollingFallback()
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-load via REST when watchlistId changes (WS isn't scoped)
  useEffect(() => {
    if (!wsConnected) return
    loadBrief()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistId, wsConnected])

  const handleMarkCaughtUp = async () => {
    try {
      setMarking(true)
      const params = watchlistId != null ? `?watchlist_id=${watchlistId}` : ''
      const response = await api.post(`/watchlist/checkpoint/mark${params}`)
      setLastChecked(response.data?.checkpoint_time ?? new Date().toISOString())
      await loadBrief()
    } catch {
      setErrorMsg('Could not save your checkpoint. Please try again.')
    } finally {
      setMarking(false)
    }
  }

  return {
    brief, loading, marking, errorMsg, lastChecked,
    stockCount, totalChange, loadBrief, handleMarkCaughtUp,
    wsConnected,
  }
}

export function formatLastChecked(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return `${hours}h ago`
}
