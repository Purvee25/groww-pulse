import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface MarketIndex {
  name: string
  price: number
  change_pct: number
}

export function Landing() {
  const navigate = useNavigate()
  const [indices, setIndices] = useState<MarketIndex[]>([])

  useEffect(() => {
    const loadIndices = async () => {
      try {
        const response = await api.get('/markets/indices')
        setIndices(response.data.indices || [])
      } catch (error) {
        console.error('Failed to fetch indices:', error)
      }
    }
    loadIndices()
    const interval = setInterval(loadIndices, 30000)
    return () => clearInterval(interval)
  }, [])

  const goToRegister = () => navigate('/register')

  const ctaButtonStyle = {
    background: 'var(--brand)',
    color: 'white',
    padding: '0.75rem 2rem',
    borderRadius: '0.5rem',
    minHeight: '44px',
    fontSize: '1rem',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 160ms var(--ease-out)',
  }

  const handlePressDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(0.97)'
  }
  const handlePressUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)'
  }

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '1.5rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Groww Pulse</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a href="/login" style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>Login</a>
          <button
            onClick={goToRegister}
            onMouseDown={handlePressDown}
            onMouseUp={handlePressUp}
            onMouseLeave={handlePressUp}
            style={{ ...ctaButtonStyle, padding: '0.5rem 1.5rem' }}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Live Market Ticker — real NSE data, no login required */}
      {indices.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0.85rem 1rem',
          overflowX: 'auto',
          display: 'flex',
          gap: '2.5rem',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'nowrap',
        }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--brand)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
            Live
          </span>
          {indices.map((idx) => (
            <div key={idx.name} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{idx.name}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{idx.price.toFixed(2)}</span>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: (idx.change_pct ?? 0) >= 0 ? 'var(--success)' : 'var(--error)',
              }}>
                {(idx.change_pct ?? 0) > 0 ? '+' : ''}{(idx.change_pct ?? 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hero Section */}
      <section style={{
        padding: '5rem 1rem 3rem',
        textAlign: 'center',
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
      }}>
        <h2 style={{
          fontSize: 'clamp(2.4rem, 6vw, 3.5rem)',
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          What has{' '}
          <span style={{ color: 'var(--brand)' }}>MEANINGFULLY</span>{' '}
          changed?
        </h2>

        {/* Animated chart illustration — draws itself on mount via stroke-dashoffset */}
        <svg
          viewBox="0 0 480 120"
          style={{ width: '100%', maxWidth: '480px', height: 'auto', opacity: 0.85 }}
          aria-hidden="true"
        >
          <style>{`
            @keyframes draw-line {
              from { stroke-dashoffset: 900; }
              to   { stroke-dashoffset: 0; }
            }
            @keyframes fade-dot {
              0%, 70% { opacity: 0; }
              100%     { opacity: 1; }
            }
            .hero-path {
              stroke-dasharray: 900;
              stroke-dashoffset: 900;
              animation: draw-line 1.6s cubic-bezier(0.23, 1, 0.32, 1) 0.3s forwards;
            }
            .hero-dot {
              opacity: 0;
              animation: fade-dot 1.6s ease 0.3s forwards;
            }
          `}</style>
          {/* Subtle grid lines */}
          {[30, 60, 90].map(y => (
            <line key={y} x1="20" y1={y} x2="460" y2={y}
              stroke="var(--border)" strokeWidth="1" />
          ))}
          {/* Market line — calm, then spike, then attention event */}
          <path
            className="hero-path"
            d="M20,85 L60,80 L100,82 L140,70 L180,74 L220,68 L240,40 L260,55 L300,50 L340,45 L380,30 L420,35 L460,28"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Annotation dot at spike */}
          <circle className="hero-dot" cx="240" cy="40" r="5" fill="var(--brand)" />
          <circle className="hero-dot" cx="240" cy="40" r="10" fill="none"
            stroke="var(--brand)" strokeWidth="1.5" strokeOpacity="0.4" />
          {/* HIGH label at spike */}
          <text className="hero-dot" x="248" y="36"
            fontSize="10" fontWeight="700" fill="var(--high, #EF4444)"
            fontFamily="ui-monospace, monospace">
            HIGH
          </text>
        </svg>

        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          maxWidth: '620px',
          margin: 0,
        }}>
          Watchlists show % changes. That's noisy. A 2% move on a calm stock matters more than 5% on a volatile one.
        </p>
        <button
          onClick={goToRegister}
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onMouseLeave={handlePressUp}
          style={ctaButtonStyle}
        >
          Get Started
        </button>
      </section>

      {/* Problem Section */}
      <section style={{
        padding: '3rem 1rem',
        maxWidth: '900px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)'
      }}>
        <h3 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>
          The Problem
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '0.75rem' }}>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Watchlists show raw %</h4>
            <p style={{ color: 'var(--text-secondary)' }}>That's noisy. Every % change looks the same.</p>
          </div>
          <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '0.75rem' }}>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>2% calm vs 5% volatile</h4>
            <p style={{ color: 'var(--text-secondary)' }}>Which one matters? Context is missing.</p>
          </div>
          <div style={{ padding: '1.5rem', background: 'var(--surface)', borderRadius: '0.75rem' }}>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>You need attention scores</h4>
            <p style={{ color: 'var(--text-secondary)' }}>Statistical ranking, not magnitude-based guesses.</p>
          </div>
        </div>
      </section>

      {/* Solution Section (3 Steps) */}
      <section style={{
        padding: '3rem 1rem',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <h3 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>
          How Groww Pulse Works
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          {([
            { num: 1, title: 'Add stocks', body: 'Build a watchlist in seconds', accent: 'var(--high, #EF4444)' },
            { num: 2, title: 'Set thesis', body: 'Optional one-liner per stock. Why watching?', accent: 'var(--medium, #F59E0B)' },
            { num: 3, title: 'Ranked by attention', body: 'z-score vs volatility, not raw %', accent: 'var(--green, #10B981)' },
          ] as const).map(({ num, title, body, accent }) => (
            <div key={num} style={{
              textAlign: 'center',
              background: 'var(--surface)',
              borderRadius: '0.75rem',
              padding: '1.75rem 1.5rem 1.5rem',
              borderTop: `2px solid ${accent}`,
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--info-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: accent,
              }}>
                {num}
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h4>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section (4 Cards) */}
      <section style={{
        padding: '3rem 1rem',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>
            Features
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            <div style={{
              padding: '1.5rem',
              background: 'var(--bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Attention Score</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Move normalized against stock volatility and how long you've been away. Statistical significance, not raw %.
              </p>
            </div>
            <div style={{
              padding: '1.5rem',
              background: 'var(--bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Checkpoints</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Mark as caught up. Next time: only show what changed since your baseline.
              </p>
            </div>
            <div style={{
              padding: '1.5rem',
              background: 'var(--bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Portfolio Risk</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Sector concentration and volatility across your whole watchlist, flagged before it's a blind spot.
              </p>
            </div>
            <div style={{
              padding: '1.5rem',
              background: 'var(--bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border)'
            }}>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Decision Journal</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                One-liner per stock + support/challenge responses. Check a move against your own reasoning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '3rem 1rem',
        textAlign: 'center',
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <h3 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          Start making better investing decisions
        </h3>
        <button
          onClick={goToRegister}
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onMouseLeave={handlePressUp}
          style={ctaButtonStyle}
        >
          Start Free
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem 1rem',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
        textAlign: 'center',
        fontSize: '0.95rem'
      }}>
        <p>© 2026 Groww Pulse. Making watchlists matter.</p>
      </footer>
    </div>
  );
}
