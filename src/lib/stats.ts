import type { Currency, Trade } from '../data/types'
import { clean } from './calc'
import { computeTrade } from './journal'

export interface EquityPoint { id: string; datetime: string; net: number; cum: number }

export interface CurrencyStats {
  currency: Currency
  count: number
  wins: number
  losses: number
  breakeven: number
  /** wins / count (breakeven trades count as non-wins). */
  winRate: number
  net: number
  grossProfit: number // sum of winning nets
  grossLoss: number // sum of losing nets (negative)
  fees: number
  avgWin: number | null
  avgLoss: number | null // negative
  /** grossProfit / |grossLoss|; Infinity if no losses but some wins; null if neither. */
  profitFactor: number | null
  largestWin: number | null
  largestLoss: number | null
  expectancy: number // net / count
  equity: EquityPoint[]
}

const CUR_ORDER: Currency[] = ['USD', 'EUR', 'GBP', 'CHF', 'JPY']

export function sortChrono(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => a.datetime.localeCompare(b.datetime) || a.createdAt.localeCompare(b.createdAt))
}

function summarize(currency: Currency, trades: Trade[]): CurrencyStats {
  let wins = 0, losses = 0, be = 0, gp = 0, gl = 0, fees = 0, cum = 0
  let lw: number | null = null, ll: number | null = null
  const equity: EquityPoint[] = []
  for (const t of sortChrono(trades)) {
    const { net } = computeTrade(t)
    fees += t.fees || 0
    if (net > 0) { wins++; gp += net; lw = lw == null ? net : Math.max(lw, net) }
    else if (net < 0) { losses++; gl += net; ll = ll == null ? net : Math.min(ll, net) }
    else be++
    cum = clean(cum + net, 8)
    equity.push({ id: t.id, datetime: t.datetime, net, cum })
  }
  const count = trades.length
  gp = clean(gp, 8); gl = clean(gl, 8)
  return {
    currency, count, wins, losses, breakeven: be,
    winRate: count ? wins / count : 0,
    net: cum, grossProfit: gp, grossLoss: gl, fees: clean(fees, 8),
    avgWin: wins ? clean(gp / wins, 8) : null,
    avgLoss: losses ? clean(gl / losses, 8) : null,
    profitFactor: losses ? clean(gp / Math.abs(gl), 6) : wins ? Infinity : null,
    largestWin: lw, largestLoss: ll,
    expectancy: count ? clean(cum / count, 8) : 0,
    equity,
  }
}

/** One stats block per currency — USD and EUR (etc.) are never summed together. */
export function computeStats(trades: Trade[]): CurrencyStats[] {
  const by = new Map<Currency, Trade[]>()
  for (const t of trades) {
    if (!by.has(t.currency)) by.set(t.currency, [])
    by.get(t.currency)!.push(t)
  }
  return [...by.entries()]
    .sort((a, b) => CUR_ORDER.indexOf(a[0]) - CUR_ORDER.indexOf(b[0]))
    .map(([c, ts]) => summarize(c, ts))
}

export interface StrategyRow {
  strategy: string
  currency: Currency
  count: number
  wins: number
  winRate: number
  net: number
  avg: number
  profitFactor: number | null
}

export function strategyBreakdown(trades: Trade[]): StrategyRow[] {
  const by = new Map<string, Trade[]>()
  for (const t of trades) {
    const k = `${t.strategy || '(none)'}\u0000${t.currency}`
    if (!by.has(k)) by.set(k, [])
    by.get(k)!.push(t)
  }
  return [...by.entries()]
    .map(([k, ts]) => {
      const [strategy, currency] = k.split('\u0000') as [string, Currency]
      const s = summarize(currency, ts)
      return { strategy, currency, count: s.count, wins: s.wins, winRate: s.winRate, net: s.net, avg: s.expectancy, profitFactor: s.profitFactor }
    })
    .sort((a, b) => CUR_ORDER.indexOf(a.currency) - CUR_ORDER.indexOf(b.currency) || b.net - a.net)
}
