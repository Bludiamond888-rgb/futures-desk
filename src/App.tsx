import { useEffect, useState } from 'react'
import { Calculator, DEFAULT_CALC } from './screens/Calculator'
import { Contracts } from './screens/Contracts'
import { Journal, type JournalTab } from './screens/Journal'
import { Prop } from './screens/Prop'
import { PropPrices } from './screens/PropPrices'
import { SEED_PRICES } from './data/propPricesSeed'
import type { PriceEntry } from './lib/propPrices'
import { EMPTY_FILTERS } from './lib/journal'
import { samplePropData, sampleTrades } from './lib/sample'
import { clearStorageError, STORAGE_KEYS, useContracts, useLocalStorage, usePropAccounts, useStorageHealth, useStrategies, useTrades, writeJSON } from './lib/storage'

type Tab = 'calculator' | 'contracts' | 'journal' | 'prop'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calculator', label: 'Calculator', icon: '∑' },
  { id: 'contracts', label: 'Contracts', icon: '☰' },
  { id: 'journal', label: 'Journal', icon: '✎' },
  { id: 'prop', label: 'Prop', icon: '◎' },
]
const SUBS: JournalTab[] = ['trades', 'stats', 'data']
type PropSub = 'accounts' | 'prices'

function parseHash(): { tab: Tab; sub: JournalTab; psub: PropSub } {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/')
  const tab = TABS.find((t) => t.id === a)?.id ?? 'calculator'
  const sub = SUBS.includes(b as JournalTab) ? (b as JournalTab) : 'trades'
  const psub: PropSub = tab === 'prop' && b === 'prices' ? 'prices' : 'accounts'
  return { tab, sub, psub }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [symbol, setSymbol] = useLocalStorage<string>(STORAGE_KEYS.calcSymbol, DEFAULT_CALC.symbol)
  const { all, custom, setCustom, addCustom, removeCustom } = useContracts()
  const { trades, setTrades, upsert, remove } = useTrades()
  const { strategies, setStrategies } = useStrategies()
  const { accounts, setAccounts, upsertAccount, removeAccount } = usePropAccounts()
  const health = useStorageHealth()
  const [prices, setPrices] = useLocalStorage<PriceEntry[]>(STORAGE_KEYS.propPrices, SEED_PRICES)
  const [priceSize, setPriceSize] = useLocalStorage<number>(STORAGE_KEYS.propPriceSize, 50_000)

  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (tab: Tab, sub: JournalTab = 'trades', psub: PropSub = 'accounts') => {
    location.hash = tab === 'journal' && sub !== 'trades' ? `/journal/${sub}` : tab === 'prop' && psub === 'prices' ? '/prop/prices' : `/${tab}`
    setRoute({ tab, sub, psub })
    window.scrollTo(0, 0)
  }

  const safeSymbol = all.some((c) => c.symbol === symbol) ? symbol : DEFAULT_CALC.symbol
  const { tab, sub, psub } = route
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('calc-lock', tab === 'calculator')
    return () => el.classList.remove('calc-lock')
  }, [tab])

  return (
    <div className={`app${tab === 'calculator' ? ' calc-lock' : ''}`}>
      <header className="topbar">
        <div className="brand"><span className="logo">F</span> Futures Calc</div>
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
        {tab === 'prop' && psub === 'prices' && (
          <section className="screen prop-prices">
            <h2 className="screen-title">Prop firm prices</h2>
            <PropPrices prices={prices} setPrices={setPrices} size={priceSize} setSize={setPriceSize} />
          </section>
        )}
        {tab === 'prop' && psub === 'accounts' && (
          <Prop accounts={accounts} upsertAccount={upsertAccount} removeAccount={removeAccount}
            trades={trades} setTrades={setTrades}
            onViewTrades={(id) => { writeJSON(STORAGE_KEYS.filters, { ...EMPTY_FILTERS, account: id }); go('journal') }}
            onLoadSample={() => {
              const sp = samplePropData()
              setTrades((p) => [...p.filter((t) => !t.sample), ...sampleTrades(), ...sp.trades])
              setAccounts((p) => [...p.filter((a) => !a.sample), ...sp.accounts])
            }} />
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
