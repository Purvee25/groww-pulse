import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'pulse_onboarded'

export function OnboardingModal() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage blocked (private mode etc.)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
    setVisible(false)
  }

  const goAdd = () => {
    dismiss()
    navigate('/watchlist')
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Pulse"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        position: 'relative',
      }}>
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: '0.25rem',
          }}
        >✕</button>

        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚡</div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 700 }}>
          Welcome to Pulse
        </h2>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.9rem' }}>
          Pulse replaces raw % changes with statistically-adjusted attention scores — so a quiet stock moving 1% outranks a volatile one moving 3%.
        </p>

        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '0.625rem',
          padding: '0.875rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.4rem' }}>How to get started</strong>
          1. Add stocks you care about — try <code style={{ background: 'var(--surface)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.82rem' }}>RELIANCE.NS</code> or <code style={{ background: 'var(--surface)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.82rem' }}>HDFCBANK.NS</code><br/>
          2. Write a one-line thesis for each (optional but powerful)<br/>
          3. Hit "Mark as caught up" — Pulse starts scoring from that moment
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={goAdd}
            style={{
              flex: 1, background: 'var(--brand)', color: 'white',
              border: 'none', borderRadius: '0.5rem',
              padding: '0.75rem 1.25rem', fontSize: '0.95rem',
              fontWeight: 700, cursor: 'pointer',
              transition: 'transform 160ms ease-out',
              minWidth: '160px',
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            Add my first stock →
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'none', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: '0.5rem',
              padding: '0.75rem 1rem', fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            I'll explore first
          </button>
        </div>
      </div>
    </div>
  )
}
