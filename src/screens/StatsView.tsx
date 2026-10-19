import { useMemo } from 'react'
import type { Trade } from '../data/types'
import { formatMoney, formatNumber } from '../lib/calc'
import { computeStats, strategyBreakdown, type CurrencyStats } from '../lib/stats'
import { EquityChart } from '../components/EquityChart'

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const pf = (x: number | null) => (x == null ? '—' : x === Infinity ? '∞' : formatNumber(x, 2))
const cls = (n: number | null) => (n == null ? '' : n > 0 ? 'pos' : n < 0 ? 'neg' : '')

interface Props { trades: Trade[]; totalCount: number; filtered: boolean }

export function StatsView({ trades, totalCount, filtered }: Props) {
  const blocks = useMemo(() => computeStats(trades), [trades])
  const strat = useMemo(() => strategyBreakdown(trades), [trades])

  if (!trades.length) {
    return <div className="panel placeholder"><h2>No stats yet</h2><p>{totalCount ? 'No trades match the current filters.' : 'Log some trades to see your stats.'}</p></div>
  }

  return (
    <div className="stats">
      {blocks.length > 1 && (
        <p className="hint cur-sep">Totals are shown separately per currency ({blocks.map((b) => b.currency).join(' / ')}); amounts are never converted or combined.</p>
      )}
      {blocks.map((s) => <CurrencyBlock key={s.currency} s={s} />)}

      <div className="panel strat-panel">
        <h3>By strategy{filtered ? <span className="muted"> (filtered)</span> : null}</h3>
        <div className="table-wrap plain">
          <table className="strat">
            <thead><tr><th>Strategy</th><th>Cur.</th><th className="num">Trades</th><th className="num">Win rate</th><th className="num">Net P&L</th><th className="num">Avg / trade</th><th className="num">PF</th></tr></thead>
            <tbody>
              {strat.map((r) => (
                <tr key={r.strategy + r.currency}>
                  <td>{r.strategy}</td><td className="dim">{r.currency}</td>
                  <td className="num">{r.count}</td><td className="num">{pct(r.winRate)}</td>
                  <td className={`num strong ${cls(r.net)}`}>{formatMoney(r.net, r.currency, 2)}</td>
                  <td className={`num ${cls(r.avg)}`}>{formatMoney(r.avg, r.currency, 2)}</td>
                  <td className="num">{pf(r.profitFactor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CurrencyBlock({ s }: { s: CurrencyStats }) {
  const m = (n: number | null) => (n == null ? '—' : formatMoney(n, s.currency, 2))
  return (
    <div className="cur-block" data-testid={`stats-${s.currency}`}>
      <div className="kpis">
        <div className="kpi hero">
          <span>Net P&L · {s.currency}</span>
          <b className={cls(s.net)} data-testid={`net-${s.currency}`}>{m(s.net)}</b>
          <em>after {m(s.fees)} fees & commissions</em>
        </div>
        <div className="kpi"><span>Trades</span><b data-testid={`count-${s.currency}`}>{s.count}</b><em>{s.wins}W · {s.losses}L{s.breakeven ? ` · ${s.breakeven} BE` : ''}</em></div>
        <div className="kpi"><span>Win rate</span><b data-testid={`winrate-${s.currency}`}>{pct(s.winRate)}</b><em>{s.wins} of {s.count} trades</em></div>
        <div className="kpi"><span>Profit factor</span><b data-testid={`pf-${s.currency}`}>{pf(s.profitFactor)}</b><em>{m(s.grossProfit)} / {m(Math.abs(s.grossLoss))}</em></div>
        <div className="kpi pair"><span>Avg win / avg loss</span>
          <b className="pos">{m(s.avgWin)}</b><b className="neg">{m(s.avgLoss)}</b>
          <em>{s.avgWin != null && s.avgLoss != null ? `ratio ${formatNumber(s.avgWin / Math.abs(s.avgLoss), 2)} : 1` : '\u00a0'}</em></div>
        <div className="kpi pair"><span>Largest win / loss</span>
          <b className="pos">{m(s.largestWin)}</b><b className="neg">{m(s.largestLoss)}</b></div>
        <div className="kpi"><span>Expectancy</span><b className={cls(s.expectancy)}>{m(s.expectancy)}</b><em>net per trade</em></div>
      </div>
      <div className="panel chart-panel">
        <h3>Equity curve · {s.currency}</h3>
        <EquityChart points={s.equity} currency={s.currency} />
      </div>
    </div>
  )
}
