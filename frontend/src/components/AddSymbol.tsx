import { useState } from 'react'
import api, { mapStockOut } from '../lib/api'
import { useStore } from '../store/store'

export function AddSymbol() {
  const { setBrief } = useStore()
  const [symbol, setSymbol] = useState('')
  const [thesis, setThesis] = useState('')
  const [showThesis, setShowThesis] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!symbol.trim()) {
      setError('Symbol is required')
      return
    }

    try {
      setLoading(true)
      const symbolUpper = symbol.trim().toUpperCase()
      const finalSymbol = symbolUpper.endsWith('.NS') ? symbolUpper : `${symbolUpper}.NS`

      await api.post('/watchlist/add', {
        symbol: finalSymbol,
        thesis_note: thesis || undefined
      })

      setSuccess(`${symbolUpper} added to watchlist!`)
      setSymbol('')
      setThesis('')
      setShowThesis(false)

      // Refresh brief
      const response = await api.get('/watchlist')
      setBrief((response.data.stocks || []).map(mapStockOut))

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{
          background: 'var(--error-bg)',
          border: '1px solid var(--error)',
          color: 'var(--error)',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.95rem'
        }} role="alert">
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.95rem'
        }} role="status">
          {success}
        </div>
      )}

      {/* Input Row */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Add symbol (e.g., RELIANCE)"
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '1rem',
            minHeight: '44px',
            fontFamily: 'inherit'
          }}
        />
        <button
          type="button"
          onClick={() => setShowThesis(!showThesis)}
          style={{
            background: 'var(--brand)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            minHeight: '44px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 200ms var(--ease-out)'
          }}
        >
          {showThesis ? '✕' : '💡'}
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: 'var(--brand)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            minHeight: '44px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            opacity: loading ? 0.5 : 1,
            transition: 'all 200ms var(--ease-out)'
          }}
        >
          {loading ? 'Adding...' : '+'}
        </button>
      </div>

      {/* Thesis Textarea */}
      {showThesis && (
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="Why are you watching this? (optional)"
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '1rem',
            minHeight: '100px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      )}
    </form>
  )
}
