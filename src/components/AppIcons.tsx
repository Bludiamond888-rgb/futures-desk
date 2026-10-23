// Crisp vector icons for the app shell (no font glyphs, no raster images).
const P = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const TabCalc = () => <svg {...P}><rect x="4.5" y="2.5" width="15" height="19" rx="3" /><path d="M8 7h8" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 19h.01M12 19h.01" strokeWidth="2.6" /></svg>
export const TabContracts = () => <svg {...P}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
export const TabJournal = () => <svg {...P}><path d="M5 3.5h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3Z" /><path d="M5 17.5a3 3 0 0 1 3-3h11" /><path d="M9 8h6" /></svg>
export const TabProp = () => <svg {...P}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>

/** App mark: rounded green square with a bold "F" drawn as vector paths (pixel-sharp at any scale). */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="logo">
    <rect width="28" height="28" rx="7" fill="#10b981" />
    <path d="M9.5 7h10v3.4h-6.2v2.6h5.4v3.3h-5.4V21H9.5Z" fill="#0b0f14" />
  </svg>
)
