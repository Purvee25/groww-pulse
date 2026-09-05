import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../lib/api'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const loginWithCredentials = async (loginEmail: string, loginPassword: string) => {
    const response = await authApi.login(loginEmail, loginPassword)
    localStorage.setItem('token', response.data.token)
    navigate('/dashboard')
  }

  const handleDemoLogin = async () => {
    setError('')
    setDemoLoading(true)
    try {
      // Same real login endpoint, same real JWT — just a pre-seeded account
      // so evaluators skip typing credentials, not a bypass of auth itself.
      await loginWithCredentials('demo@groww.in', 'demo1234')
    } catch (err: any) {
      setError('Demo account unavailable — try logging in manually')
    } finally {
      setDemoLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    try {
      setLoading(true)
      const response = await authApi.login(email, password)
      localStorage.setItem('token', response.data.token)
      if (rememberMe) {
        localStorage.setItem('rememberEmail', email)
      }
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        setError(detail[0].msg)
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg)',
      color: 'var(--text)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border)',
        padding: '2rem',
        width: '100%',
        maxWidth: '380px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
          Groww Pulse
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          What changed enough to matter?
        </p>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={demoLoading}
          style={{
            width: '100%',
            background: 'var(--info-bg)',
            color: 'var(--brand)',
            border: '1px solid var(--brand)',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            minHeight: '44px',
            fontWeight: 700,
            fontSize: '0.95rem',
            marginBottom: '1.25rem',
            opacity: demoLoading ? 0.6 : 1,
            cursor: demoLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {demoLoading ? 'Logging in…' : '⚡ Try the live demo (pre-loaded watchlist)'}
        </button>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          Real login, real account — just skips typing credentials
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>
          Welcome Back
        </h2>

        {error && (
          <div style={{
            background: 'var(--error-bg)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Email */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
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
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 2.5rem 0.75rem 0.75rem',
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
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  fontSize: '0.875rem'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Remember me</span>
          </label>

          {/* Log In Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--brand)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              minHeight: '44px',
              fontWeight: 600,
              fontSize: '1rem',
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        {/* Register Link */}
        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          Need account?{' '}
          <Link to="/register" style={{ color: 'var(--brand)', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
