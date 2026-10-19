import { describe, expect, it } from 'vitest'
import { calculate, formatMoney, formatTreasury, parseMove, parseTreasury } from './calc'
import { CONTRACTS, CONTRACT_BY_SYMBOL as C } from '../data/contracts'

describe('calculate – required examples', () => {
  it('5 MNQ × 10 points = $100', () => {
    const r = calculate(C.MNQ, 5, 10, 'points')
    expect(r.value).toBe(100)
    expect(r.ticks).toBe(40)
    expect(r.valuePerTick).toBe(0.5)
    expect(r.valuePerPoint).toBe(2)
  })
  it('same move entered as 40 ticks gives $100', () => {
    const r = calculate(C.MNQ, 5, 40, 'ticks')
    expect(r.value).toBe(100)
    expect(r.points).toBe(10)
  })
})

describe('spec sanity checks', () => {
  const cases: [string, number, number, number][] = [
    // symbol, tickSize, tickValue, pointValue
    ['ES', 0.25, 12.5, 50],
    ['MNQ', 0.25, 0.5, 2],
    ['NQ', 0.25, 5, 20],
    ['CL', 0.01, 10, 1000],
    ['GC', 0.1, 10, 100],
    ['ZB', 1 / 32, 31.25, 1000],
    ['ZN', 1 / 64, 15.625, 1000],
    ['ZF', 1 / 128, 7.8125, 1000],
    ['ZT', 1 / 256, 7.8125, 2000],
    ['ZC', 0.25, 12.5, 50],
    ['FDAX', 1, 25, 25],
    ['FGBL', 0.01, 10, 1000],
    ['6E', 0.00005, 6.25, 125000],
  ]
  it.each(cases)('%s tick %d = %d, point = %d', (sym, ts, tv, pv) => {
    expect(C[sym].tickSize).toBe(ts)
    expect(C[sym].tickValue).toBe(tv)
    expect(C[sym].pointValue).toBe(pv)
  })

  it('every contract: pointValue === tickValue / tickSize and fields sane', () => {
    for (const k of CONTRACTS) {
      expect(k.tickSize, k.symbol).toBeGreaterThan(0)
      expect(k.tickValue, k.symbol).toBeGreaterThan(0)
      expect(k.pointValue, k.symbol).toBeCloseTo(k.tickValue / k.tickSize, 4)
    }
  })
  it('symbols are unique', () => {
    const s = CONTRACTS.map((k) => k.symbol)
    expect(new Set(s).size).toBe(s.length)
  })
})

describe('calculate – general', () => {
  it('ES 2 contracts, 8 ticks = 2 points = $200', () => {
    const r = calculate(C.ES, 2, 8, 'ticks')
    expect(r.value).toBe(200)
    expect(r.points).toBe(2)
  })
  it('CL 1 contract, 0.35 points = 35 ticks = $350 (no float noise)', () => {
    const r = calculate(C.CL, 1, 0.35, 'points')
    expect(r.ticks).toBe(35)
    expect(r.value).toBe(350)
  })
  it('GC 3 contracts, 12.3 points = 123 ticks = $3,690', () => {
    const r = calculate(C.GC, 3, 12.3, 'points')
    expect(r.ticks).toBe(123)
    expect(r.value).toBe(3690)
  })
  it('negative moves produce negative values', () => {
    expect(calculate(C.ES, 1, -4, 'points').value).toBe(-200)
  })
  it('flags fractional ticks', () => {
    expect(calculate(C.ES, 1, 0.1, 'points').fractionalTicks).toBe(true)
    expect(calculate(C.ES, 1, 0.5, 'points').fractionalTicks).toBe(false)
  })
  it('zero contracts => zero', () => {
    expect(calculate(C.ES, 0, 10, 'points').value).toBe(0)
  })
  it('EUR contract (FDAX) 2 × 15 pts = 750', () => {
    expect(calculate(C.FDAX, 2, 15, 'points').value).toBe(750)
  })
})

describe('treasuries', () => {
  it('ZB 1 point (1 full handle) = 32 ticks = $1,000', () => {
    const r = calculate(C.ZB, 1, 1, 'points')
    expect(r.ticks).toBe(32)
    expect(r.value).toBe(1000)
  })
  it('ZN 1 point = 64 ticks (half-32nds) = $1,000', () => {
    const r = calculate(C.ZN, 1, 1, 'points')
    expect(r.ticks).toBe(64)
    expect(r.value).toBe(1000)
  })
  it('ZN 3 ticks = 1.5/32 = $46.875', () => {
    const r = calculate(C.ZN, 1, 3, 'ticks')
    expect(r.value).toBe(46.875)
    expect(r.points).toBe(0.046875)
    expect(formatTreasury(r.points)).toBe('0-01.5')
  })
  it('ZF 1-16 move (1.5 points) × 2 = $3,000 = 192 ticks', () => {
    const pts = parseMove('1-16', C.ZF, 'points')
    expect(pts).toBe(1.5)
    const r = calculate(C.ZF, 2, pts, 'points')
    expect(r.value).toBe(3000)
    expect(r.ticks).toBe(192)
  })
  it('ZT 1 tick = 1/8 of 1/32 = $7.8125; 1 handle = $2,000', () => {
    expect(calculate(C.ZT, 1, 1, 'ticks').value).toBe(7.8125)
    expect(calculate(C.ZT, 1, 1, 'points').value).toBe(2000)
    expect(calculate(C.ZT, 1, 1, 'points').ticks).toBe(256)
  })
  it('parseTreasury variants', () => {
    expect(parseTreasury('1-16')).toBe(1.5)
    expect(parseTreasury("1'16")).toBe(1.5)
    expect(parseTreasury('0-08.5')).toBe(8.5 / 32)
    expect(parseTreasury('0-08+')).toBe(8.5 / 32)
    expect(parseTreasury('-0-16')).toBe(-0.5)
    expect(parseTreasury('2.25')).toBe(2.25)
    expect(parseTreasury('-16')).toBe(-16) // plain decimal
    expect(parseTreasury('1-32')).toBeNaN()
    expect(parseTreasury('abc')).toBeNaN()
  })
  it('formatTreasury', () => {
    expect(formatTreasury(1.5)).toBe('1-16')
    expect(formatTreasury(0.265625)).toBe('0-08.5')
    expect(formatTreasury(0.0078125)).toBe('0-00.25')
    expect(formatTreasury(1 / 256)).toBe('0-00.125')
    expect(formatTreasury(-2)).toBe('-2-00')
  })
})

describe('parseMove / formatting', () => {
  it('decimal contracts reject treasury notation', () => {
    expect(parseMove('1-16', C.ES, 'points')).toBeNaN()
    expect(parseMove('10', C.ES, 'points')).toBe(10)
    expect(parseMove('1,000', C.ES, 'ticks')).toBe(1000)
  })
  it('ticks for treasuries are plain numbers', () => {
    expect(parseMove('3', C.ZN, 'ticks')).toBe(3)
  })
  it('formatMoney', () => {
    expect(formatMoney(100, 'USD')).toBe('$100.00')
    expect(formatMoney(15.625, 'USD')).toBe('$15.625')
    expect(formatMoney(-1234.5, 'EUR')).toBe('−€1,234.50')
  })
})
