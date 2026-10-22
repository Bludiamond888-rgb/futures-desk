import { describe, expect, it } from 'vitest'
import { allInCost, parsePriceFile, rankForSize, type PriceEntry } from './propPrices'
import { SEED_PRICES } from '../data/propPricesSeed'

const base = { evalFee: 100, discountPct: 0, activationFee: 0, otherFees: 0 }
const entry = (id: string, size: number, p: Partial<PriceEntry>): PriceEntry => ({ id, firm: id, size, billing: 'one-time', promoCode: '', notes: '', url: '', lastChecked: '2026-10-18', ...base, ...p })

describe('allInCost', () => {
  it('no discount, no fees = eval fee', () => expect(allInCost(base).total).toBe(100))
  it('applies % discount to evaluation only', () => {
    const c = allInCost({ evalFee: 179, discountPct: 50, activationFee: 1, otherFees: 0 })
    expect(c).toMatchObject({ evalAfter: 89.5, discount: 89.5, activation: 1, total: 90.5 })
  })
  it('adds activation and other fees', () => expect(allInCost({ evalFee: 207, discountPct: 0, activationFee: 87, otherFees: 10 }).total).toBe(304))
  it('rounds to cents', () => expect(allInCost({ evalFee: 265, discountPct: 90, activationFee: 0, otherFees: 0 }).total).toBe(26.5))
  it('clamps bad inputs', () => {
    expect(allInCost({ evalFee: 100, discountPct: 150, activationFee: -5, otherFees: NaN }).total).toBe(0)
    expect(allInCost({ evalFee: -1, discountPct: -10, activationFee: 5, otherFees: 0 }).total).toBe(5)
  })
})

describe('rankForSize', () => {
  it('filters by size and sorts cheapest first', () => {
    const list = [entry('a', 50000, { evalFee: 200 }), entry('b', 50000, { evalFee: 300, discountPct: 50 }), entry('c', 150000, { evalFee: 1 })]
    expect(rankForSize(list, 50000).map((x) => x.e.id)).toEqual(['b', 'a'])
  })
})

describe('seed data', () => {
  it('reproduces the scouting scan all-in totals (cheapest 50K = $26.50, 150K = $67.50)', () => {
    expect(SEED_PRICES.length).toBeGreaterThan(40)
    expect(rankForSize(SEED_PRICES, 50000)[0].c.total).toBe(26.5)
    expect(rankForSize(SEED_PRICES, 150000)[0].c.total).toBe(67.5)
  })
  it('round-trips export/import', () => {
    const f = JSON.stringify({ app: 'futures-desk-prop-prices', version: 1, prices: SEED_PRICES })
    expect(parsePriceFile(f)).toEqual(SEED_PRICES)
    expect(() => parsePriceFile('{"x":1}')).toThrow()
  })
})
