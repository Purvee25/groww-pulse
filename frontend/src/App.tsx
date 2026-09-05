import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Register } from './pages/Register'
import { Login } from './pages/Login'
import { Explore } from './pages/Explore'
import { Watchlist } from './pages/Watchlist'
import { Journal } from './pages/Journal'
import { StockPage } from './pages/StockPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = !!localStorage.getItem('token')
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = !!localStorage.getItem('token')
  return !isAuthenticated ? children : <Navigate to="/explore" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
        <Route path="/dashboard" element={<Navigate to="/explore" replace />} />
        <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
        <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
        <Route path="/stock/:symbol" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
