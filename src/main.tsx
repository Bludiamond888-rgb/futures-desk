import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS home-screen app quirk (black-translucent status bar): the page is drawn from the top of the screen,
// but the viewport iOS gives it stops one status-bar height (~62px) short of the bottom. Fixed content can't
// be painted below that line, so the home indicator is already outside our viewport and the tab bar must
// not add its own home-indicator padding (which made it look too tall with an empty band).
function detectShortViewport() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  const portrait = window.innerHeight >= window.innerWidth
  const gap = (portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)) - window.innerHeight
  document.documentElement.classList.toggle('ios-short-vp', standalone && gap >= 20 && gap <= 120)
}
detectShortViewport()
window.addEventListener('resize', detectShortViewport)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: only for the hosted PWA build (not the single-file build, not file://, not dev).
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW registration failed', e))
  })
}
