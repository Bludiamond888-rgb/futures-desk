import type { ContractSpec, Currency } from '../data/types'

export type MoveUnit = 'points' | 'ticks'

type SpecLike = Pick<ContractSpec, 'tickSize' | 'tickValue'> & Partial<Pick<ContractSpec, 'pointValue'>>

export interface CalcResult {
  /** Total money value of the move for all contracts. */
  value: number
  /** Move expressed in points (1.0 price units / treasury handles). */
  points: number
  /** Move expressed in ticks. */
  ticks: number
  valuePerTick: number
  valuePerPoint: number
  /** true when the move is not a whole number of ticks. */
  fractionalTicks: boolean
}

/** Remove floating-point noise (e.g. 0.30000000000000004 → 0.3). */
export function clean(n: number, digits = 9): number {
  if (!Number.isFinite(n)) return n
  const f = 10 ** digits
  const r = Math.round(n * f) / f
  return Object.is(r, -0) ? 0 : r
}

export function pointValueOf(spec: SpecLike): number {
  return clean(spec.tickValue / spec.tickSize, 6)
}

/**
 * value = contracts × points × pointValue   (move given in points)
 * value = contracts × ticks  × tickValue    (move given in ticks)
 * Both forms are equivalent because pointValue = tickValue / tickSize.
 */
export function calculate(spec: SpecLike, contracts: number, move: number, unit: MoveUnit): CalcResult {
  const valuePerTick = spec.tickValue
  const valuePerPoint = pointValueOf(spec)
  let points: number
  let ticks: number
  let value: number
  if (unit === 'points') {
    points = move
    ticks = clean(move / spec.tickSize)
    value = contracts * points * valuePerPoint
  } else {
    ticks = move
    points = clean(move * spec.tickSize)
    value = contracts * ticks * valuePerTick
  }
  value = clean(value, 8)
  return {
    value,
    points: clean(points),
    ticks: clean(ticks),
    valuePerTick,
    valuePerPoint,
    fractionalTicks: Math.abs(ticks - Math.round(ticks)) > 1e-7,
  }
}

// ───────────── US Treasury 32nds helpers ─────────────

/**
 * Parse a treasury-style move/price: "1-16" = 1 + 16/32 = 1.5,
 * "0-08.5" = 8.5/32, "0-08+" = 8.5/32, "1'16" also accepted.
 * Plain decimals ("1.5") pass through. Returns NaN if unparseable.
 */
export function parseTreasury(input: string): number {
  const s = input.trim()
  if (s === '') return NaN
  const m = s.match(/^([+-]?)(\d+)\s*['\-]\s*(\d{1,2}(?:\.\d+)?)(\+)?$/)
  if (!m) {
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s)
    return NaN
  }
  const sign = m[1] === '-' ? -1 : 1
  const handle = Number(m[2])
  let thirtySeconds = Number(m[3])
  if (m[4]) thirtySeconds += 0.5
  if (thirtySeconds >= 32) return NaN
  return sign * clean(handle + thirtySeconds / 32)
}

/** Format points as handle-32nds, e.g. 1.5 → "1-16", 0.265625 → "0-08.5". */
export function formatTreasury(points: number): string {
  const sign = points < 0 ? '-' : ''
  const abs = Math.abs(points)
  let handle = Math.floor(abs + 1e-12)
  let t = clean((abs - handle) * 32, 6)
  if (t >= 32) { handle += 1; t -= 32 }
  const whole = Math.floor(t + 1e-12)
  const frac = clean(t - whole, 6)
  const fracStr = frac === 0 ? '' : String(frac).replace(/^0/, '') // ".5", ".25", ".125"
  return `${sign}${handle}-${String(whole).padStart(2, '0')}${fracStr}`
}

/** Parse a move typed by the user for a given contract. */
export function parseMove(input: string, spec: Pick<ContractSpec, 'priceFormat'>, unit: MoveUnit): number {
  const s = input.trim().replace(/,/g, '')
  if (s === '') return NaN
  if (unit === 'points' && spec.priceFormat === '32nds') return parseTreasury(s)
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
  return Number(s)
}

// ───────────── Formatting ─────────────

const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£', CHF: 'CHF ', JPY: '¥' }

export function formatMoney(n: number, currency: Currency, maxFrac = 4): string {
  if (!Number.isFinite(n)) return '—'
  const minFrac = currency === 'JPY' ? 0 : 2
  const s = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: Math.max(minFrac, maxFrac),
  })
  return `${n < 0 ? '−' : ''}${SYMBOL[currency] ?? currency + ' '}${s}`
}

export function formatNumber(n: number, maxFrac = 8): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac })
}
