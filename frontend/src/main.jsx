import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ─── Service Worker ──────────────────────────────────────────────────────────
// Cache static assets + thumbnails → repeat visit jauh lebih cepat
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.debug('[SW] registered:', reg.scope))
      .catch(err => console.warn('[SW] register failed:', err));
  });
}
// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
