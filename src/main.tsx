import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS home-screen apps (black-translucent status bar) can report a layout height that stops short of the
// home indicator, leaving an empty band under the tab bar. Size the locked app to the real screen there.
function setAppHeight() {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  let h = window.innerHeight
  if (standalone && screen.height && screen.width) {
    const portrait = window.innerHeight >= window.innerWidth
    const sh = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    // only bridge the small status-bar-sized shortfall; a bigger gap means the keyboard is open
    if (sh > h && sh - h <= 120) h = sh
  }
  document.documentElement.style.setProperty('--app-h', `${h}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 300))

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
