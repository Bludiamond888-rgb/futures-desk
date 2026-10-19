import { useMemo, useState } from 'react'
import type { Trade } from '../data/types'
import { formatMoney, formatNumber } from '../lib/calc'
import { computeTrade, formatDateTime, formatPrice } from '../lib/journal'
import { computeStats } from '../lib/stats'
import { ConfirmDialog, Modal } from '../components/Modal'
import { IconCopy, IconEdit, IconImage, IconTrash } from '../components/Icons'

type SortKey = 'datetime' | 'symbol' | 'side' | 'qty' | 'entry' | 'exit' | 'ticks' | 'points' | 'net' | 'strategy'
const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'datetime', label: 'Date / time' },
  { key: 'symbol', label: 'Contract' },
  { key: 'side', label: 'Side' },
  { key: 'qty', label: 'Qty', num: true },
  { key: 'entry', label: 'Entry', num: true },
  { key: 'exit', label: 'Exit', num: true },
  { key: 'ticks', label: 'Ticks', num: true },
  { key: 'points', label: 'Points', num: true },
  { key: 'net', label: 'Net P&L', num: true },
  { key: 'strategy', label: 'Strategy' },
]

interface Props {
  trades: Trade[]
  totalCount: number
  onEdit: (t: Trade) => void
  onDuplicate: (t: Trade) => void
  onDelete: (id: string) => void
  onLoadSample: () => void
}

export function TradesView({ trades, totalCount, onEdit, onDuplicate, onDelete, onLoadSample }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'datetime', dir: -1 })
  const [confirm, setConfirm] = useState<Trade | null>(null)
  const [viewShot, setViewShot] = useState<Trade | null>(null)

  const rows = useMemo(() => {
    const withCalc = trades.map((t) => ({ t, c: computeTrade(t) }))
    const val = (r: (typeof withCalc)[number]): string | number => {
      switch (sort.key) {
        case 'ticks': return r.c.ticks
        case 'points': return r.c.points
        case 'net': return r.c.net
        default: return r.t[sort.key] as string | number
      }
    }
    return withCalc.sort((a, b) => {
      const va = val(a), vb = val(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return cmp * sort.dir || b.t.datetime.localeCompare(a.t.datetime)
    })
  }, [trades, sort])

  const totals = useMemo(() => computeStats(trades), [trades])
  const clickSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'datetime' || COLS.find((c) => c.key === key)?.num ? -1 : 1 }))

  if (totalCount === 0) {
    return (
      <div className="panel placeholder">
        <h2>No trades yet</h2>
        <p>Log your first trade with <b>+ New trade</b>. Everything stays on this device.</p>
        <p className="hint">Want to look around first? You can load clearly-labelled sample trades from <button type="button" className="linkish" onClick={onLoadSample}>Data → Load sample data</button>.</p>
      </div>
    )
  }

  const actions = (t: Trade) => (
    <div className="row-actions">
      {t.screenshot && <button type="button" className="icon-btn" onClick={() => setViewShot(t)} aria-label="View screenshot" title="Screenshot"><IconImage /></button>}
      <button type="button" className="icon-btn" onClick={() => onEdit(t)} aria-label="Edit" title="Edit"><IconEdit /></button>
      <button type="button" className="icon-btn" onClick={() => onDuplicate(t)} aria-label="Duplicate" title="Duplicate"><IconCopy /></button>
      <button type="button" className="icon-btn danger" onClick={() => setConfirm(t)} aria-label="Delete" title="Delete"><IconTrash /></button>
    </div>
  )
  const pnlCls = (n: number) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '')

  return (
    <>
      <div className="summary-strip" data-testid="summary">
        <span className="muted">{trades.length} of {totalCount} trades</span>
        {totals.map((s) => (
          <span key={s.currency} className={`pill ${pnlCls(s.net)}`}>{s.currency} net <b>{formatMoney(s.net, s.currency, 2)}</b></span>
        ))}
      </div>

      {trades.length === 0 ? <p className="empty panel">No trades match the filters.</p> : <>
        {/* Desktop table */}
        <div className="table-wrap">
          <table className="trades">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => clickSort(c.key)}>
                      {c.label}<span className="sort-ind">{sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, c }) => (
                <tr key={t.id}>
                  <td className="mono dim">{formatDateTime(t.datetime)}</td>
                  <td><span className="sym">{t.symbol}</span>{t.sample && <span className="badge sample">Sample</span>}</td>
                  <td><span className={`side-tag ${t.side}`}>{t.side === 'long' ? 'Long' : 'Short'}</span></td>
                  <td className="num">{t.qty}</td>
                  <td className="num">{formatPrice(t.entry, t)}</td>
                  <td className="num">{formatPrice(t.exit, t)}</td>
                  <td className={`num ${pnlCls(c.ticks)}`}>{formatNumber(c.ticks, 2)}</td>
                  <td className={`num ${pnlCls(c.points)}`}>{formatNumber(c.points, 6)}</td>
                  <td className={`num strong ${pnlCls(c.net)}`} title={`Gross ${formatMoney(c.gross, t.currency, 2)} − fees ${formatMoney(c.fees, t.currency, 2)}`}>{formatMoney(c.net, t.currency, 2)}</td>
                  <td className="dim">{t.strategy || '—'}</td>
                  <td>{actions(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="trade-cards">
          <div className="mobile-sort">
            <label>Sort
              <select value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [k, d] = e.target.value.split(':'); setSort({ key: k as SortKey, dir: Number(d) as 1 | -1 }) }}>
                <option value="datetime:-1">Newest first</option>
                <option value="datetime:1">Oldest first</option>
                <option value="net:-1">Biggest win</option>
                <option value="net:1">Biggest loss</option>
                <option value="symbol:1">Contract A–Z</option>
                <option value="strategy:1">Strategy A–Z</option>
              </select>
            </label>
          </div>
          {rows.map(({ t, c }) => (
            <article key={t.id} className="tcard">
              <div className="tc-top">
                <div>
                  <span className="sym">{t.symbol}</span>
                  <span className={`side-tag ${t.side}`}>{t.side === 'long' ? 'Long' : 'Short'} {t.qty}</span>
                  {t.sample && <span className="badge sample">Sample</span>}
                </div>
                <b className={`tc-pnl ${pnlCls(c.net)}`}>{formatMoney(c.net, t.currency, 2)}</b>
              </div>
              <div className="tc-mid">
                <span>{formatPrice(t.entry, t)} → {formatPrice(t.exit, t)}</span>
                <span className={pnlCls(c.ticks)}>{formatNumber(c.ticks, 2)} ticks · {formatNumber(c.points, 6)} pts</span>
              </div>
              <div className="tc-bot">
                <span className="dim">{formatDateTime(t.datetime)}{t.strategy ? ` · ${t.strategy}` : ''}{t.fees ? ` · fees ${formatMoney(t.fees, t.currency, 2)}` : ''}</span>
                {actions(t)}
              </div>
              {t.notes && <p className="tc-notes">{t.notes}</p>}
            </article>
          ))}
        </div>
      </>}

      {confirm && (
        <ConfirmDialog
          title="Delete trade?"
          danger
          confirmLabel="Delete"
          message={<>Delete <b>{confirm.side} {confirm.qty} {confirm.symbol}</b> from {formatDateTime(confirm.datetime)} ({formatMoney(computeTrade(confirm).net, confirm.currency, 2)})? This can’t be undone.</>}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { onDelete(confirm.id); setConfirm(null) }}
        />
      )}
      {viewShot?.screenshot && (
        <Modal title={`${viewShot.symbol} · ${formatDateTime(viewShot.datetime)}`} onClose={() => setViewShot(null)} wide>
          <img src={viewShot.screenshot} alt="Trade screenshot" className="shot-full" />
        </Modal>
      )}
    </>
  )
}
