import { useMemo, useState } from 'react'
import type { ContractSpec, Trade } from '../data/types'
import { EMPTY_FILTERS, filterTrades, type TradeFilters } from '../lib/journal'
import { STORAGE_KEYS, useLocalStorage } from '../lib/storage'
import { TradeForm, StrategyManager, type FormMode } from '../components/TradeForm'
import { TradesView } from './TradesView'
import { StatsView } from './StatsView'
import { DataView } from './DataView'

export type JournalTab = 'trades' | 'stats' | 'data'

interface Props {
  sub: JournalTab
  onSub: (s: JournalTab) => void
  contracts: ContractSpec[]
  customContracts: ContractSpec[]
  setCustomContracts: (c: ContractSpec[]) => void
  trades: Trade[]
  setTrades: (t: Trade[] | ((p: Trade[]) => Trade[])) => void
  upsert: (t: Trade) => void
  remove: (id: string) => void
  strategies: string[]
  setStrategies: (s: string[]) => void
  defaultSymbol: string
}

export function Journal(props: Props) {
  const { sub, onSub, contracts, trades, setTrades, upsert, remove, strategies, setStrategies, defaultSymbol } = props
  const [filters, setFilters] = useLocalStorage<TradeFilters>(STORAGE_KEYS.filters, EMPTY_FILTERS)
  const [form, setForm] = useState<{ mode: FormMode; trade: Trade | null } | null>(null)
  const [stratOpen, setStratOpen] = useState(false)
  const filtered = useMemo(() => filterTrades(trades, filters), [trades, filters])

  const usage = useMemo(() => {
    const u: Record<string, number> = {}
    for (const t of trades) if (t.strategy) u[t.strategy] = (u[t.strategy] ?? 0) + 1
    return u
  }, [trades])

  const symbolsInUse = useMemo(() => [...new Set(trades.map((t) => t.symbol))].sort(), [trades])
  const strategyOptions = useMemo(() => [...new Set([...strategies, ...trades.map((t) => t.strategy).filter(Boolean)])], [strategies, trades])
  const activeFilters = !!(filters.symbol || filters.strategy || filters.from || filters.to)

  const filterBar = (
    <div className="filters" data-testid="filters">
      <select aria-label="Filter by contract" value={filters.symbol} onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}>
        <option value="">All contracts</option>
        {symbolsInUse.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select aria-label="Filter by strategy" value={filters.strategy} onChange={(e) => setFilters({ ...filters, strategy: e.target.value })}>
        <option value="">All strategies</option>
        {strategyOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="date-f"><span>From</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
      <label className="date-f"><span>To</span><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
      {activeFilters && <button type="button" className="btn ghost sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>}
    </div>
  )

  return (
    <section className="screen journal">
      <div className="j-head">
        <div className="subtabs" role="tablist">
          {(['trades', 'stats', 'data'] as JournalTab[]).map((t) => (
            <button key={t} role="tab" aria-selected={sub === t} className={sub === t ? 'on' : ''} onClick={() => onSub(t)}>
              {t === 'trades' ? 'Trades' : t === 'stats' ? 'Stats' : 'Data'}
            </button>
          ))}
        </div>
        {sub !== 'data' && (
          <button type="button" className="btn primary" onClick={() => setForm({ mode: 'new', trade: null })}>+ New trade</button>
        )}
      </div>

      {sub !== 'data' && filterBar}

      {sub === 'trades' && (
        <TradesView
          trades={filtered}
          totalCount={trades.length}
          onEdit={(t) => setForm({ mode: 'edit', trade: t })}
          onDuplicate={(t) => setForm({ mode: 'duplicate', trade: t })}
          onDelete={remove}
          onLoadSample={() => onSub('data')}
        />
      )}
      {sub === 'stats' && <StatsView trades={filtered} totalCount={trades.length} filtered={activeFilters} />}
      {sub === 'data' && (
        <DataView
          trades={trades} setTrades={setTrades} contracts={contracts}
          customContracts={props.customContracts} setCustomContracts={props.setCustomContracts}
          strategies={strategies} setStrategies={setStrategies}
        />
      )}

      {form && (
        <TradeForm
          mode={form.mode}
          initial={form.trade}
          contracts={contracts}
          strategies={strategies}
          defaultSymbol={defaultSymbol}
          onClose={() => setForm(null)}
          onSave={(t) => { upsert(t); setForm(null) }}
          onManageStrategies={() => setStratOpen(true)}
        />
      )}
      {stratOpen && (
        <StrategyManager
          strategies={strategies}
          usage={usage}
          onChange={setStrategies}
          onRename={(from, to) => {
            setStrategies(strategies.map((s) => (s === from ? to : s)))
            setTrades((prev) => prev.map((t) => (t.strategy === from ? { ...t, strategy: to, updatedAt: new Date().toISOString() } : t)))
            if (filters.strategy === from) setFilters({ ...filters, strategy: to })
          }}
          onClose={() => setStratOpen(false)}
        />
      )}
    </section>
  )
}
