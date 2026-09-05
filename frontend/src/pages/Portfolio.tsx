import { NavBar } from '../components/NavBar'
import { PortfolioRisk } from '../components/PortfolioRisk'

export function Portfolio() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      <NavBar />
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2.5rem 1rem 4rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.375rem', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Portfolio Risk
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Sector concentration and volatility across your watchlist.
          </p>
        </div>
        <PortfolioRisk />
      </main>
    </div>
  )
}
