export type Billing = 'monthly' | 'one-time'
export interface PriceEntry {
  id: string
  firm: string
  size: number
  evalFee: number
  billing: Billing
  activationFee: number
  otherFees: number
  promoCode: string
  discountPct: number
  notes: string
  url: string
  lastChecked: string // YYYY-MM-DD
  source?: string
  sample?: boolean
}

export const PRESET_SIZES = [25_000, 50_000, 100_000, 150_000, 300_000]
export const sizeK = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}K` : `$${n.toLocaleString('en-US')}`)

const r2 = (n: number) => Math.round(n * 100) / 100
const clean = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export interface AllIn { evalFee: number; discountPct: number; discount: number; evalAfter: number; activation: number; other: number; total: number }

/** All-in = evaluation × (1 − discount%) + activation + required/other fees. Discount clamped to 0–100%. */
export function allInCost(e: Pick<PriceEntry, 'evalFee' | 'discountPct' | 'activationFee' | 'otherFees'>): AllIn {
  const evalFee = clean(e.evalFee)
  const discountPct = Math.min(100, clean(e.discountPct))
  const evalAfter = r2(evalFee * (1 - discountPct / 100))
  const activation = clean(e.activationFee)
  const other = clean(e.otherFees)
  return { evalFee, discountPct, discount: r2(evalFee - evalAfter), evalAfter, activation, other, total: r2(evalAfter + activation + other) }
}

/** Entries for one size, cheapest all-in first (ties: firm name). */
export function rankForSize(list: PriceEntry[], size: number) {
  return list.filter((e) => e.size === size)
    .map((e) => ({ e, c: allInCost(e) }))
    .sort((a, b) => a.c.total - b.c.total || a.e.firm.localeCompare(b.e.firm))
}

export function parsePriceFile(text: string): PriceEntry[] {
  let o: unknown
  try { o = JSON.parse(text) } catch { throw new Error('Not valid JSON') }
  const list = Array.isArray(o) ? o : (o as { app?: string; prices?: unknown })?.app === 'futures-desk-prop-prices' ? (o as { prices: unknown }).prices : null
  if (!Array.isArray(list)) throw new Error('Not a Futures Desk prop prices file')
  for (const e of list) {
    if (!e || typeof e.id !== 'string' || typeof e.firm !== 'string' || !(e.size > 0) || !Number.isFinite(e.evalFee)) throw new Error('File contains an invalid price entry')
  }
  return list as PriceEntry[]
}
