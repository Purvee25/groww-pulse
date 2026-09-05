import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import api, { mapStockOut } from '../lib/api'
import { useStore } from '../store/store'

export interface BriefItem {
  symbol: string
  company_name: string
  price: number
  price_change_pct: number
  price_change_24h?: number
  attention_score: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  narration: string
  freshness: 'live' | 'delayed' | 'stale'
  market_state: 'open' | 'closed'
  is_first_visit: boolean
  thesis_note?: string
  thesis_verdict?: 'SUPPORTED' | 'CHALLENGED' | 'NEUTRAL'
  thesis_verdict_reason?: string
  regime?: 'NORMAL' | 'HIGH_VOLATILITY_EXPANSION'
  vix?: number
  thesis_updated_at?: string
  thesis_stale?: boolean
  week_52_high?: number
  week_52_low?: number
  sector_adjusted?: boolean
  volume?: number
  avg_volume_20d?: number
  market_cap?: string
  checkpoint_price?: number
  sensitivity?: string
  quiet_for_ms?: number | null
}

interface StockDetailProps {
  isOpen: boolean
  onClose: () => void
  item: BriefItem | null
  startInThesisEdit?: boolean
}

export function StockDetail({ isOpen, onClose, item, startInThesisEdit }: StockDetailProps) {
  const [editingThesis, setEditingThesis] = useState(false)
  const [thesisText, setThesisText] = useState(item?.thesis_note || '')
  const [thesisResponse, setThesisResponse] = useState<'supports' | 'challenges' | 'uncertain' | null>(null)
  const [loading, setLoading] = useState(false)
  const setBrief = useStore((s) => s.setBrief)

  useEffect(() => {
    if (isOpen && startInThesisEdit) {
      setThesisText(item?.thesis_note || '')
      setEditingThesis(true)
    }
  }, [isOpen, startInThesisEdit, item?.thesis_note])

  if (!item) return null

  const refreshBrief = async () => {
    const response = await api.get('/watchlist')
    setBrief((response.data.stocks || []).map(mapStockOut))
  }

  const handleThesisSave = async () => {
    try {
      setLoading(true)
      await api.post(`/watchlist/${item.symbol}/thesis`, {
        thesis: thesisText
      })
      setEditingThesis(false)
      await refreshBrief()
    } catch (error) {
      console.error('Failed to save thesis:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleThesisResponse = async (response: 'supports' | 'challenges' | 'uncertain') => {
    try {
      setLoading(true)
      await api.post(`/watchlist/${item.symbol}/response`, {
        response
      })
      setThesisResponse(response)
    } catch (error) {
      console.error('Failed to save thesis response:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (confirm(`Remove ${item.symbol} from watchlist?`)) {
      try {
        await api.delete(`/watchlist/${item.symbol}`)
        onClose()
        await refreshBrief()
      } catch (error) {
        console.error('Failed to remove stock:', error)
      }
    }
  }

  const FRESHNESS_COLORS: Record<string, string> = {
    live: '#10B981',
    delayed: '#F59E0B',
    stale: '#EF4444',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1.5rem'
        }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--brand)' }}>
              {item.symbol.replace('.NS', '')}
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: 0 }}>
              {item.company_name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '0.5rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Price Section */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{
            fontSize: '3rem',
            fontFamily: 'monospace',
            fontWeight: 700,
            margin: '0 0 0.5rem 0',
            color: 'var(--text)'
          }}>
            ₹{(item.price ?? 0).toFixed(2)}
          </p>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <p style={{
              fontSize: '1.25rem',
              margin: 0,
              color: item.price_change_pct >= 0 ? 'var(--success)' : 'var(--error)',
              fontWeight: 600
            }}>
              {(item.price_change_pct ?? 0) > 0 ? '+' : ''}{(item.price_change_pct ?? 0).toFixed(2)}%
            </p>
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--text-muted)',
              margin: 0
            }}>
              {(item.price_change_24h ?? 0) > 0 ? '+' : ''}₹{(item.price_change_24h ?? 0).toFixed(2)} (24h)
            </p>
            <span style={{
              background: FRESHNESS_COLORS[item.freshness] || 'var(--text-muted)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {item.freshness}
            </span>
          </div>
        </div>

        {/* Data Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'var(--bg)',
          borderRadius: '0.5rem'
        }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>52w High</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>₹{item.week_52_high?.toFixed(2) || 'N/A'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>52w Low</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>₹{item.week_52_low?.toFixed(2) || 'N/A'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Volume</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{(item.volume || 0) / 1000}k</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Avg Vol (20d)</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{(item.avg_volume_20d || 0) / 1000}k</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Market Cap</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{item.market_cap || 'N/A'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Attention</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--brand)' }}>{Math.round(item.attention_score)}</p>
          </div>
        </div>

        {/* Thesis Section */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg)', borderRadius: '0.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem 0' }}>Your Thesis</h3>

          {!editingThesis && (
            <>
              {item.thesis_note ? (
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 1rem 0', paddingLeft: '1rem', borderLeft: '2px solid var(--border-light)' }}>
                  "{item.thesis_note}"
                </p>
              ) : (
                <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>No thesis set</p>
              )}
              <button
                onClick={() => setEditingThesis(true)}
                style={{
                  background: 'transparent',
                  color: 'var(--brand)',
                  border: '1px solid var(--brand)',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {item.thesis_note ? 'Edit' : 'Add'} Thesis
              </button>
            </>
          )}

          {editingThesis && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                value={thesisText}
                onChange={(e) => setThesisText(e.target.value)}
                placeholder="Why are you watching this stock?"
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleThesisSave}
                  disabled={loading}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: loading ? 0.5 : 1
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingThesis(false)}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Thesis Prompt */}
          {(item.priority === 'HIGH' || item.priority === 'MEDIUM') && item.thesis_note && !editingThesis && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Does this move support or challenge your thesis?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleThesisResponse('supports')}
                  style={{
                    background: thesisResponse === 'supports' ? 'var(--success)' : 'transparent',
                    color: thesisResponse === 'supports' ? 'white' : 'var(--success)',
                    border: '1px solid var(--success)',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Supports
                </button>
                <button
                  onClick={() => handleThesisResponse('challenges')}
                  style={{
                    background: thesisResponse === 'challenges' ? 'var(--error)' : 'transparent',
                    color: thesisResponse === 'challenges' ? 'white' : 'var(--error)',
                    border: '1px solid var(--error)',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Challenges
                </button>
                <button
                  onClick={() => handleThesisResponse('uncertain')}
                  style={{
                    background: thesisResponse === 'uncertain' ? 'var(--warning)' : 'transparent',
                    color: thesisResponse === 'uncertain' ? 'white' : 'var(--warning)',
                    border: '1px solid var(--warning)',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  Uncertain
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)'
        }}>
          <button
            onClick={handleRemove}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--error)',
              border: '1px solid var(--error)',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              minHeight: '40px'
            }}
          >
            Remove from Watchlist
          </button>
        </div>
      </div>
    </Modal>
  )
}
