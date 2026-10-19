import { useEffect, useState } from 'react'
import { Calculator, DEFAULT_CALC } from './screens/Calculator'
import { Contracts } from './screens/Contracts'
import { Journal, type JournalTab } from './screens/Journal'
import { clearStorageError, STORAGE_KEYS, useContracts, useLocalStorage, useStorageHealth, useStrategies, useTrades } from './lib/storage'

type Tab = 'calculator' | 'contracts' | 'journal'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calculator', label: 'Calculator', icon: '∑' },
  { id: 'contracts', label: 'Contracts', icon: '☰' },
  { id: 'journal', label: 'Journal', icon: '✎' },
]
const SUBS: JournalTab[] = ['trades', 'stats', 'data']

function parseHash(): { tab: Tab; sub: JournalTab } {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/')
  const tab = TABS.find((t) => t.id === a)?.id ?? 'calculator'
  const sub = SUBS.includes(b as JournalTab) ? (b as JournalTab) : 'trades'
  return { tab, sub }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [symbol, setSymbol] = useLocalStorage<string>(STORAGE_KEYS.calcSymbol, DEFAULT_CALC.symbol)
  const { all, custom, setCustom, addCustom, removeCustom } = useContracts()
  const { trades, setTrades, upsert, remove } = useTrades()
  const { strategies, setStrategies } = useStrategies()
  const health = useStorageHealth()

  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (tab: Tab, sub: JournalTab = 'trades') => {
    location.hash = tab === 'journal' && sub !== 'trades' ? `/journal/${sub}` : `/${tab}`
    setRoute({ tab, sub })
    window.scrollTo(0, 0)
  }

  const safeSymbol = all.some((c) => c.symbol === symbol) ? symbol : DEFAULT_CALC.symbol
  const { tab, sub } = route

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">F</span> Futures Desk</div>
        <nav className="tabs top">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>
      {health.error && (
        <div className="banner err" role="alert">{health.error} <button type="button" className="linkish" onClick={clearStorageError}>Dismiss</button></div>
      )}
      {!health.error && health.nearLimit && tab === 'journal' && (
        <div className="banner warn" role="status">On-device storage is {Math.round(health.ratio * 100)}% full. Download a backup (Journal → Data) and remove old screenshots.</div>
      )}
      <main>
        {tab === 'calculator' && <Calculator contracts={all} symbol={safeSymbol} onSymbolChange={setSymbol} />}
        {tab === 'contracts' && (
          <Contracts contracts={all} onAdd={addCustom} onRemove={removeCustom}
            onOpen={(s) => { setSymbol(s); go('calculator') }} />
        )}
        {tab === 'journal' && (
          <Journal
            sub={sub} onSub={(s) => go('journal', s)}
            contracts={all} customContracts={custom} setCustomContracts={setCustom}
            trades={trades} setTrades={setTrades} upsert={upsert} remove={remove}
            strategies={strategies} setStrategies={setStrategies}
            defaultSymbol={safeSymbol}
          />
        )}
      </main>
      <nav className="tabs bottom">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            <span className="ic" aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
