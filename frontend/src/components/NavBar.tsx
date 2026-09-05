import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

const LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/journal', label: 'Journal' },
]

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>
    </svg>
  )
}

export function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const saved = localStorage.getItem('groww-pulse-theme') as 'light' | 'dark' | null
    const initial = saved ?? 'light'
    setTheme(initial)
    document.documentElement.setAttribute('data-theme', initial)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('groww-pulse-theme', next)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.5rem',
      height: '56px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backdropFilter: 'blur(12px)',
      gap: '1rem',
    }}>
      {/* Logo */}
      <Link to="/explore" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '8px', background: 'var(--brand)',
        }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 11.5 5.5 7l3 2.5L14 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Groww Pulse
        </span>
      </Link>

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: 0, alignItems: 'center', borderBottom: 'none' }}>
        {LINKS.map((link) => {
          const active = location.pathname === link.to || (link.to === '/explore' && location.pathname === '/dashboard')
          return (
            <Link key={link.to} to={link.to} style={{
              textDecoration: 'none',
              padding: '0.4rem 1rem',
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
              whiteSpace: 'nowrap',
              transition: 'color 150ms',
            }}>
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button onClick={toggleTheme} aria-label="Toggle theme" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '34px', height: '34px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-muted)', cursor: 'pointer',
        }}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button onClick={handleLogout} style={{
          background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border)', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 500,
          padding: '0.375rem 0.875rem', borderRadius: '6px',
        }}>
          Log out
        </button>
      </div>
    </header>
  )
}
