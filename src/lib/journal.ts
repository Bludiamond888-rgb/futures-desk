import type { ContractSpec, Trade } from '../data/types'
import { clean, formatNumber, formatTreasury } from './calc'

export interface TradeCalc {
  /** Signed price move in the trade's favour (points). */
  points: number
  ticks: number
  pointValue: number
  gross: number
  fees: number
  net: number
  /** Money at risk to the stop (only if a valid stop is set). */
  risk: number | null
  /** R multiple = points / stop distance (price based, before fees). */
  r: number | null
}

/**
 * P&L from the spec snapshot stored on the trade.
 *   points = (exit − entry) × (long ? 1 : −1)
 *   ticks  = points / tickSize
 *   gross  = ticks × tickValue × qty   (= points × pointValue × qty)
 *   net    = gross − fees
 */
export function computeTrade(t: Pick<Trade, 'side' | 'entry' | 'exit' | 'qty' | 'fees' | 'stop' | 'tickSize' | 'tickValue'>): TradeCalc {
  const dir = t.side === 'long' ? 1 : -1
  const points = clean((t.exit - t.entry) * dir)
  const ticks = clean(points / t.tickSize)
  const pointValue = clean(t.tickValue / t.tickSize, 6)
  const gross = clean(ticks * t.tickValue * t.qty, 8)
  const fees = t.fees || 0
  const net = clean(gross - fees, 8)
  let risk: number | null = null
  let r: number | null = null
  if (t.stop != null && Number.isFinite(t.stop)) {
    const riskPts = clean((t.entry - t.stop) * dir)
    if (riskPts > 0) {
      risk = clean(riskPts * pointValue * t.qty, 8)
      r = clean(points / riskPts, 4)
    }
  }
  return { points, ticks, pointValue, gross, fees, net, risk, r }
}

export function snapshotSpec(spec: ContractSpec) {
  return {
    tickSize: spec.tickSize,
    tickValue: spec.tickValue,
    currency: spec.currency,
    ...(spec.priceFormat ? { priceFormat: spec.priceFormat } : {}),
  }
}

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fall through */ }
  return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Decimal places implied by a tick size (0.25 → 2, 0.0001 → 4, 5 → 0). */
export function decimalsFor(tickSize: number): number {
  const s = String(tickSize)
  if (s.includes('e-')) return Number(s.split('e-')[1])
  return s.includes('.') ? s.split('.')[1].length : 0
}

export function formatPrice(price: number, t: Pick<Trade, 'tickSize' | 'priceFormat'>): string {
  if (!Number.isFinite(price)) return '—'
  if (t.priceFormat === '32nds') return formatTreasury(price)
  const d = Math.min(decimalsFor(t.tickSize), 8)
  return price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 8) })
}

/** Price as an editable string ("110-16.5" for treasuries). */
export function priceInput(price: number | null | undefined, t: Pick<Trade, 'priceFormat'>): string {
  if (price == null || !Number.isFinite(price)) return ''
  return t.priceFormat === '32nds' ? formatTreasury(price) : String(price)
}

export function formatDateTime(dt: string): string {
  return dt.replace('T', ' ')
}

export interface TradeFilters {
  symbol: string // '' = all
  strategy: string // '' = all
  from: string // 'YYYY-MM-DD' or ''
  to: string
}
export const EMPTY_FILTERS: TradeFilters = { symbol: '', strategy: '', from: '', to: '' }

export function filterTrades(trades: Trade[], f: TradeFilters): Trade[] {
  return trades.filter((t) => {
    if (f.symbol && t.symbol !== f.symbol) return false
    if (f.strategy && t.strategy !== f.strategy) return false
    const d = t.datetime.slice(0, 10)
    if (f.from && d < f.from) return false
    if (f.to && d > f.to) return false
    return true
  })
}

export const fmtTicks = (n: number) => formatNumber(n, 2)
