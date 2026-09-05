import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
}

// Backend StockOut uses different field names than the frontend's BriefItem shape.
// Map at the boundary so every consumer sees one consistent shape.
interface StockOutDto {
  symbol: string
  price: number
  stock_return_pct: number
  attention_score: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  narrative: string
  freshness: 'live' | 'delayed' | 'stale'
  is_market_open: boolean
  thesis: string | null
  thesis_verdict: 'SUPPORTED' | 'CHALLENGED' | 'NEUTRAL' | null
  thesis_verdict_reason: string | null
  regime: 'NORMAL' | 'HIGH_VOLATILITY_EXPANSION'
  vix: number | null
  thesis_updated_at: string | null
  thesis_stale: boolean
  last_seen_price: number | null
  last_seen_at: string | null
  added_at: string
  week_52_high?: number | null
  week_52_low?: number | null
  sector_adjusted?: boolean
  sensitivity?: string
  quiet_for_ms?: number | null
}

export function mapStockOut(dto: StockOutDto) {
  return {
    symbol: dto.symbol,
    company_name: dto.symbol.replace('.NS', ''),
    price: dto.price,
    price_change_pct: dto.stock_return_pct,
    attention_score: dto.attention_score,
    priority: dto.priority,
    narration: dto.narrative,
    freshness: dto.freshness,
    market_state: dto.is_market_open ? ('open' as const) : ('closed' as const),
    is_first_visit: dto.last_seen_at === null,
    thesis_note: dto.thesis ?? undefined,
    thesis_verdict: dto.thesis_verdict ?? undefined,
    thesis_verdict_reason: dto.thesis_verdict_reason ?? undefined,
    regime: dto.regime,
    vix: dto.vix ?? undefined,
    thesis_updated_at: dto.thesis_updated_at ?? undefined,
    thesis_stale: dto.thesis_stale,
    checkpoint_price: dto.last_seen_price ?? undefined,
    week_52_high: dto.week_52_high ?? undefined,
    week_52_low: dto.week_52_low ?? undefined,
    sector_adjusted: dto.sector_adjusted ?? false,
    sensitivity: dto.sensitivity ?? 'normal',
    quiet_for_ms: dto.quiet_for_ms ?? null,
  }
}

export default api
