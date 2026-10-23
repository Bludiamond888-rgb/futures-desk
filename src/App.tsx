import { lazy, Suspense, useCallback, useEffect, useState, type ComponentType } from 'react'
import { Calculator, DEFAULT_CALC } from './screens/Calculator'
import { parseHash, routeHash, type JournalSub as JournalTab, type PropSub, type Tab } from './lib/route'
import { EMPTY_FILTERS } from './lib/journal'
import { clearStorageError, STORAGE_KEYS, useContracts, useLocalStorage, usePropAccounts, useStorageHealth, useStrategies, useTrades, writeJSON } from './lib/storage'
import { Logo, TabCalc, TabContracts, TabJournal, TabProp } from './components/AppIcons'

// Code-split: only the Calculator ships in the startup bundle; other tabs load on first visit
// (and are prefetched when the browser is idle, so switching is instant and works offline).
const loaders = {
  contracts: () => import('./screens/Contracts').then((m) => ({ default: m.Contracts })),
  journal: () => import('./screens/Journal').then((m) => ({ default: m.Journal })),
  prop: () => import('./screens/Prop').then((m) => ({ default: m.Prop })),
  prices: () => import('./screens/PropPricesTab'),
}
const Contracts = lazy(loaders.contracts)
const Journal = lazy(loaders.journal)
const Prop = lazy(loaders.prop)
const PropPricesTab = lazy(loaders.prices)

const TABS: { id: Tab; label: string; Icon: ComponentType }[] = [
  { id: 'calculator', label: 'Calculator', Icon: TabCalc },
  { id: 'contracts', label: 'Contracts', Icon: TabContracts },
  { id: 'journal', label: 'Journal', Icon: TabJournal },
  { id: 'prop', label: 'Prop', Icon: TabProp },
]
export default function App() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  const [symbol, setSymbol] = useLocalStorage<string>(STORAGE_KEYS.calcSymbol, DEFAULT_CALC.symbol)
  const { all, custom, setCustom, addCustom, removeCustom } = useContracts()
  const { trades, setTrades, upsert, remove } = useTrades()
  const { strategies, setStrategies } = useStrategies()
  const { accounts, setAccounts, upsertAccount, removeAccount } = usePropAccounts()
  const health = useStorageHealth()

  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', on)
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    idle(() => { for (const l of Object.values(loaders)) l().catch(() => {}) })
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = useCallback((tab: Tab, sub: JournalTab = 'trades', psub: PropSub = 'accounts') => {
    const r = { tab, sub, psub }
    location.hash = routeHash(r)
    setRoute(r)
    window.scrollTo(0, 0)
  }, [])

  const safeSymbol = all.some((c) => c.symbol === symbol) ? symbol : DEFAULT_CALC.symbol
  const { tab, sub, psub } = route

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><Logo /> <span>Futures Calc</span></div>
        <nav className="tabs top" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>{t.label}</button>
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
        <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
          {tab === 'calculator' && <Calculator contracts={all} symbol={safeSymbol} onSymbolChange={setSymbol} accounts={accounts} trades={trades} />}
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
              accounts={accounts} setAccounts={setAccounts}
            />
          )}
          {tab === 'prop' && (
            <div className="prop-subnav">
              <div className="subtabs" role="tablist" aria-label="Prop section">
                <button role="tab" aria-selected={psub === 'accounts'} className={psub === 'accounts' ? 'on' : ''} onClick={() => go('prop', 'trades', 'accounts')}>Accounts</button>
                <button role="tab" aria-selected={psub === 'prices'} className={psub === 'prices' ? 'on' : ''} onClick={() => go('prop', 'trades', 'prices')}>Prices</button>
              </div>
            </div>
          )}
          {tab === 'prop' && psub === 'prices' && <PropPricesTab />}
          {tab === 'prop' && psub === 'accounts' && (
            <Prop accounts={accounts} upsertAccount={upsertAccount} removeAccount={removeAccount}
              trades={trades} setTrades={setTrades}
              onViewTrades={(id) => { writeJSON(STORAGE_KEYS.filters, { ...EMPTY_FILTERS, account: id }); go('journal') }}
              onLoadSample={async () => {
                const { samplePropData, sampleTrades } = await import('./lib/sample')
                const sp = samplePropData()
                setTrades((p) => [...p.filter((t) => !t.sample), ...sampleTrades(), ...sp.trades])
                setAccounts((p) => [...p.filter((a) => !a.sample), ...sp.accounts])
              }} />
          )}
        </Suspense>
      </main>
      <nav className="tabs bottom" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
