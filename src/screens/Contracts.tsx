import { useMemo, useState } from 'react'
import { CATEGORIES, CURRENCIES, type Category, type ContractSpec, type Currency } from '../data/types'
import { matchContract } from '../components/ContractPicker'
import { formatMoney, formatNumber, pointValueOf } from '../lib/calc'

interface Props {
  contracts: ContractSpec[]
  onOpen: (symbol: string) => void
  onAdd: (c: ContractSpec) => void
  onRemove: (symbol: string) => void
}

type Filter = Category | 'All' | 'Custom'

export function Contracts({ contracts, onOpen, onAdd, onRemove }: Props) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  const [showForm, setShowForm] = useState(false)

  const chips: Filter[] = useMemo(() => {
    const present = CATEGORIES.filter((cat) => contracts.some((c) => c.category === cat))
    return ['All', ...present, ...(contracts.some((c) => c.custom) ? (['Custom'] as Filter[]) : [])]
  }, [contracts])

  const shown = contracts.filter(
    (c) =>
      (filter === 'All' || (filter === 'Custom' ? c.custom : c.category === filter)) &&
      matchContract(c, q.trim()),
  )

  return (
    <section className="screen lib">
      <div className="lib-head">
        <input className="search" placeholder={`Search ${contracts.length} contracts…`} value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search contracts" />
        <button type="button" className="btn primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close form' : '+ Add custom contract'}
        </button>
      </div>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            {c}
            <span className="n">{c === 'All' ? contracts.length : c === 'Custom' ? contracts.filter((x) => x.custom).length : contracts.filter((x) => x.category === c).length}</span>
          </button>
        ))}
      </div>

      {showForm && (
        <CustomForm
          existing={contracts}
          onSave={(c) => { onAdd(c); setShowForm(false); setFilter('Custom') }}
        />
      )}

      <div className="cards">
        {shown.map((c) => (
          <article className="card" key={c.symbol}>
            <header>
              <div>
                <div className="card-sym">{c.symbol}</div>
                <div className="card-name">{c.name}</div>
              </div>
              <div className="badges">
                <span className="badge ex">{c.exchange}</span>
                {c.custom ? <span className="badge custom">Custom</span> : !c.verified && <span className="badge warn" title="See notes">Unverified</span>}
              </div>
            </header>
            <dl>
              <dt>Tick size</dt><dd>{c.tickLabel ? `${c.tickLabel} (${formatNumber(c.tickSize, 9)})` : formatNumber(c.tickSize, 9)}</dd>
              <dt>Tick value</dt><dd>{formatMoney(c.tickValue, c.currency)}</dd>
              <dt>Point value</dt><dd>{formatMoney(c.pointValue, c.currency)}</dd>
              <dt>Contract</dt><dd>{c.contractSize}</dd>
              <dt>Category</dt><dd className="plain">{c.category}</dd>
            </dl>
            {c.quoteNotes && <p className="notes">{c.quoteNotes}</p>}
            <footer>
              <button type="button" className="btn primary sm" onClick={() => onOpen(c.symbol)}>Open in calculator →</button>
              {c.custom ? (
                <button type="button" className="btn ghost sm" onClick={() => { if (confirm(`Delete custom contract ${c.symbol}?`)) onRemove(c.symbol) }}>Delete</button>
              ) : c.source ? (
                <a className="src" href={c.source} target="_blank" rel="noreferrer">Exchange spec ↗</a>
              ) : null}
            </footer>
          </article>
        ))}
        {shown.length === 0 && <p className="empty">No contracts match.</p>}
      </div>
    </section>
  )
}

function CustomForm({ existing, onSave }: { existing: ContractSpec[]; onSave: (c: ContractSpec) => void }) {
  const [f, setF] = useState({
    symbol: '', name: '', exchange: '', category: 'Other' as Category, currency: 'USD' as Currency,
    tickSize: '', tickValue: '', contractSize: '', quoteNotes: '',
  })
  const ts = Number(f.tickSize), tv = Number(f.tickValue)
  const sym = f.symbol.trim().toUpperCase()
  const errors: string[] = []
  if (!sym) errors.push('Symbol is required')
  else if (existing.some((c) => c.symbol.toUpperCase() === sym)) errors.push(`Symbol ${sym} already exists`)
  if (!(ts > 0)) errors.push('Tick size must be > 0')
  if (!(tv > 0)) errors.push('Tick value must be > 0')
  const pv = ts > 0 && tv > 0 ? pointValueOf({ tickSize: ts, tickValue: tv }) : NaN
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <form className="panel custom-form" onSubmit={(e) => {
      e.preventDefault()
      if (errors.length) return
      onSave({
        symbol: sym, name: f.name.trim() || sym, exchange: f.exchange.trim() || 'Custom', category: f.category,
        tickSize: ts, tickValue: tv, pointValue: pv, currency: f.currency,
        contractSize: f.contractSize.trim() || '—', quoteNotes: f.quoteNotes.trim(), verified: false, custom: true,
      })
    }}>
      <h3>Add custom contract</h3>
      <div className="form-grid">
        <label>Symbol*<input value={f.symbol} onChange={set('symbol')} placeholder="e.g. FTSE" /></label>
        <label>Name<input value={f.name} onChange={set('name')} placeholder="e.g. FTSE 100" /></label>
        <label>Exchange<input value={f.exchange} onChange={set('exchange')} placeholder="e.g. ICE Europe" /></label>
        <label>Category<select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Tick size*<input inputMode="decimal" value={f.tickSize} onChange={set('tickSize')} placeholder="e.g. 0.5" /></label>
        <label>Tick value*<input inputMode="decimal" value={f.tickValue} onChange={set('tickValue')} placeholder="e.g. 5" /></label>
        <label>Currency<select value={f.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Contract size<input value={f.contractSize} onChange={set('contractSize')} placeholder="e.g. £10 × index" /></label>
        <label className="wide">Quote notes<input value={f.quoteNotes} onChange={set('quoteNotes')} placeholder="Optional" /></label>
      </div>
      <div className="form-foot">
        <span className="pv">Point value: <b>{Number.isFinite(pv) ? formatMoney(pv, f.currency) : '—'}</b> <em>(tick value ÷ tick size)</em></span>
        <button type="submit" className="btn primary" disabled={errors.length > 0}>Save contract</button>
      </div>
      {errors.length > 0 && (f.symbol || f.tickSize || f.tickValue) && <p className="warn">{errors.join(' · ')}</p>}
      <p className="hint">Saved on this device only (localStorage).</p>
    </form>
  )
}
