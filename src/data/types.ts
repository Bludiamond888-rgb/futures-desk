export type Category =
  | 'Equity Index'
  | 'Energy'
  | 'Metals'
  | 'Interest Rates'
  | 'FX'
  | 'Grains'
  | 'Livestock'
  | 'Softs'
  | 'Crypto'
  | 'Volatility'
  | 'Other'

export const CATEGORIES: Category[] = [
  'Equity Index', 'Energy', 'Metals', 'Interest Rates', 'FX',
  'Grains', 'Livestock', 'Softs', 'Crypto', 'Volatility', 'Other',
]

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'JPY'
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'CHF', 'JPY']

/** How prices are displayed. '32nds' = US Treasury handle-and-32nds notation. */
export type PriceFormat = 'decimal' | '32nds'

export interface ContractSpec {
  symbol: string
  name: string
  exchange: string
  category: Category
  /** Minimum price fluctuation, in the contract's quoted price units. */
  tickSize: number
  /** Money value of one tick for one contract, in `currency`. */
  tickValue: number
  /** Money value of a 1.0 move in the quoted price (= tickValue / tickSize). */
  pointValue: number
  currency: Currency
  contractSize: string
  /** What "1 point" means and any quoting quirks. */
  quoteNotes: string
  priceFormat?: PriceFormat
  /** Human label for the tick, e.g. "1/2 of 1/32". */
  tickLabel?: string
  /** true = tick size/value checked against the official exchange page (Oct 18, 2026). */
  verified: boolean
  source?: string
  custom?: boolean
}

// ───────────── Journal ─────────────

export type Side = 'long' | 'short'

export interface Trade {
  id: string
  /** Local date-time "YYYY-MM-DDTHH:mm" (no timezone, as entered). */
  datetime: string
  symbol: string
  side: Side
  qty: number
  entry: number
  exit: number
  stop: number | null
  /** Total commissions + fees for the whole round trip, in the contract currency. */
  fees: number
  strategy: string
  notes: string
  /** Spec snapshot at save time so P&L survives spec edits / custom-contract deletion. */
  tickSize: number
  tickValue: number
  currency: Currency
  priceFormat?: PriceFormat
  /** Compressed JPEG data URL (optional). */
  screenshot?: string
  sample?: boolean
  createdAt: string
  updatedAt: string
}

export const DEFAULT_STRATEGIES = ['ORB', 'VWAP bounce', 'Breakout', 'Pullback', 'Reversal']
