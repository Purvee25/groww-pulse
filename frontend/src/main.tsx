import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply saved theme before first paint to avoid flash
;(function () {
  const saved = localStorage.getItem('groww-pulse-theme') as 'light' | 'dark' | null
  const theme = saved ?? 'dark'  // dark by default — terminal-grade product
  document.documentElement.setAttribute('data-theme', theme)
  if (!saved) localStorage.setItem('groww-pulse-theme', 'dark')
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
