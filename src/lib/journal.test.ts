import { describe, expect, it } from 'vitest'
import type { Trade } from '../data/types'
import { CONTRACT_BY_SYMBOL as C } from '../data/contracts'
import { computeTrade, filterTrades, formatPrice, snapshotSpec } from './journal'
import { computeStats, strategyBreakdown } from './stats'
import { mergeTrades, parseCSV, tradesFromCSV, tradesToCSV } from './csv'
import { makeBackup, parseBackup } from './backup'
import { CONTRACTS } from '../data/contracts'
import { sampleTrades } from './sample'

let n = 0
function mk(p: Partial<Trade> & { symbol: string }): Trade {
  n++
  return {
    id: `t${n}`, datetime: `2026-10-0${(n % 9) + 1}T10:00`, side: 'long', qty: 1, entry: 100, exit: 101,
    stop: null, fees: 0, strategy: 'ORB', notes: '', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    ...snapshotSpec(C[p.symbol]), ...p,
  }
}

describe('computeTrade (P&L)', () => {
  it('MNQ long 5 × +10 pts, $3.70 fees → gross 100, net 96.30', () => {
    const r = computeTrade(mk({ symbol: 'MNQ', qty: 5, entry: 20000, exit: 20010, fees: 3.7 }))
    expect(r.points).toBe(10); expect(r.ticks).toBe(40)
    expect(r.gross).toBe(100); expect(r.net).toBe(96.3)
  })
  it('short profits when price falls', () => {
    const r = computeTrade(mk({ symbol: 'ES', side: 'short', qty: 2, entry: 5850, exit: 5845.5 }))
    expect(r.points).toBe(4.5); expect(r.ticks).toBe(18); expect(r.gross).toBe(450)
  })
  it('short loses when price rises', () => {
    expect(computeTrade(mk({ symbol: 'ES', side: 'short', entry: 5850, exit: 5851 })).net).toBe(-50)
  })
  it('CL 0.24 move, no float noise', () => {
    const r = computeTrade(mk({ symbol: 'CL', side: 'short', entry: 71.42, exit: 71.18, fees: 4.2 }))
    expect(r.ticks).toBe(24); expect(r.gross).toBe(240); expect(r.net).toBe(235.8)
  })
  it('ZN treasury: short 2 from 110-16 to 110-13 = 6 ticks ×2 = $187.50', () => {
    const r = computeTrade(mk({ symbol: 'ZN', side: 'short', qty: 2, entry: 110.5, exit: 110.40625 }))
    expect(r.points).toBe(0.09375); expect(r.ticks).toBe(6); expect(r.gross).toBe(187.5)
  })
  it('EUR contract stays in EUR units (FDAX +34 pts = €850)', () => {
    const t = mk({ symbol: 'FDAX', entry: 19412, exit: 19446 })
    expect(t.currency).toBe('EUR'); expect(computeTrade(t).gross).toBe(850)
  })
  it('risk and R multiple from stop', () => {
    const r = computeTrade(mk({ symbol: 'ES', entry: 5850, exit: 5860, stop: 5845 }))
    expect(r.risk).toBe(250); expect(r.r).toBe(2)
  })
  it('stop on the wrong side → no risk/R', () => {
    const r = computeTrade(mk({ symbol: 'ES', entry: 5850, exit: 5860, stop: 5855 }))
    expect(r.risk).toBeNull(); expect(r.r).toBeNull()
  })
  it('formatPrice', () => {
    expect(formatPrice(110.515625, C.ZN)).toBe('110-16.5')
    expect(formatPrice(5850, C.ES)).toBe('5,850.00')
    expect(formatPrice(71.4, C.CL)).toBe('71.40')
  })
})

describe('stats', () => {
  const trades = [
    mk({ symbol: 'ES', datetime: '2026-10-01T10:00', entry: 100, exit: 102 }), // +100
    mk({ symbol: 'ES', datetime: '2026-10-02T10:00', entry: 100, exit: 99, strategy: 'Breakout' }), // -50
    mk({ symbol: 'ES', datetime: '2026-10-03T10:00', entry: 100, exit: 104, fees: 10 }), // +190
    mk({ symbol: 'ES', datetime: '2026-10-04T10:00', entry: 100, exit: 100 }), // 0
    mk({ symbol: 'FDAX', datetime: '2026-10-02T03:00', entry: 100, exit: 90, fees: 5 }), // -255 EUR
  ]
  const [usd, eur] = computeStats(trades)
  it('separates currencies, USD first', () => {
    expect(usd.currency).toBe('USD'); expect(eur.currency).toBe('EUR')
    expect(usd.count).toBe(4); expect(eur.count).toBe(1)
  })
  it('totals, win rate, averages, PF, extremes', () => {
    expect(usd.net).toBe(240)
    expect(usd.wins).toBe(2); expect(usd.losses).toBe(1); expect(usd.breakeven).toBe(1)
    expect(usd.winRate).toBe(0.5)
    expect(usd.avgWin).toBe(145); expect(usd.avgLoss).toBe(-50)
    expect(usd.profitFactor).toBe(5.8)
    expect(usd.largestWin).toBe(190); expect(usd.largestLoss).toBe(-50)
    expect(usd.fees).toBe(10)
    expect(usd.expectancy).toBe(60)
  })
  it('equity curve is chronological cumulative net', () => {
    expect(usd.equity.map((p) => p.cum)).toEqual([100, 50, 240, 240])
  })
  it('EUR stats untouched by USD', () => {
    expect(eur.net).toBe(-255); expect(eur.profitFactor).toBe(0); expect(eur.avgWin).toBeNull()
  })
  it('profit factor ∞ with wins and no losses, null with neither', () => {
    expect(computeStats([mk({ symbol: 'ES' })])[0].profitFactor).toBe(Infinity)
    expect(computeStats([mk({ symbol: 'ES', exit: 100 })])[0].profitFactor).toBeNull()
  })
  it('empty → no blocks', () => expect(computeStats([])).toEqual([]))
  it('strategy breakdown per strategy & currency', () => {
    const rows = strategyBreakdown(trades)
    const orb = rows.find((r) => r.strategy === 'ORB' && r.currency === 'USD')!
    expect(orb.count).toBe(3); expect(orb.net).toBe(290); expect(orb.winRate).toBeCloseTo(2 / 3)
    expect(rows.find((r) => r.strategy === 'Breakout')!.net).toBe(-50)
    expect(rows.find((r) => r.currency === 'EUR')!.net).toBe(-255)
  })
  it('filters by symbol, strategy and date range (inclusive)', () => {
    expect(filterTrades(trades, { symbol: 'ES', strategy: '', from: '', to: '' })).toHaveLength(4)
    expect(filterTrades(trades, { symbol: '', strategy: 'Breakout', from: '', to: '' })).toHaveLength(1)
    expect(filterTrades(trades, { symbol: '', strategy: '', from: '2026-10-02', to: '2026-10-03' })).toHaveLength(3)
  })
})

describe('CSV', () => {
  const tricky: Trade[] = [
    mk({ symbol: 'MNQ', notes: 'Comma, "quotes", and\nnew line — ünïcode 🚀', strategy: 'VWAP bounce', stop: 19990, fees: 3.7 }),
    mk({ symbol: 'ZN', side: 'short', entry: 110.515625, exit: 110.40625, qty: 3, notes: '  padded  ' }),
    mk({ symbol: 'FDAX', notes: '' , strategy: '' }),
    mk({ symbol: 'CL', entry: -37.63, exit: 0.1 + 0.2, notes: '=SUM(A1)' }),
  ]
  it('round-trips exactly (screenshots excluded)', () => {
    const csv = tradesToCSV(tricky)
    const back = tradesFromCSV(csv, CONTRACTS)
    expect(back.errors).toEqual([])
    expect(back.trades).toEqual(tricky)
  })
  it('round-trips sample data', () => {
    const s = sampleTrades().map(({ sample: _s, ...t }) => t as Trade)
    expect(tradesFromCSV(tradesToCSV(s), CONTRACTS).trades).toEqual(s)
  })
  it('double round-trip is stable', () => {
    const once = tradesToCSV(tricky)
    expect(tradesToCSV(tradesFromCSV(once, CONTRACTS).trades)).toBe(once)
  })
  it('parses CRLF, LF and BOM', () => {
    expect(parseCSV('\uFEFFa,b\r\n1,"x\r\ny"\n2,3')).toEqual([['a', 'b'], ['1', 'x\r\ny'], ['2', '3']])
  })
  it('minimal CSV (no spec columns) fills specs from contract table', () => {
    const r = tradesFromCSV('datetime,symbol,side,qty,entry,exit\n2026-10-01 09:30,ES,long,1,5000,5001\n', CONTRACTS)
    expect(r.errors).toEqual([])
    expect(r.trades[0].tickValue).toBe(12.5); expect(r.trades[0].datetime).toBe('2026-10-01T09:30')
  })
  it('reports bad rows but keeps good ones', () => {
    const r = tradesFromCSV('datetime,symbol,side,qty,entry,exit\n2026-10-01,ES,sideways,1,1,2\n2026-10-01,ES,long,1,1,2\n2026-10-01,XXX,long,1,1,2\n', CONTRACTS)
    expect(r.trades).toHaveLength(1); expect(r.errors).toHaveLength(2)
  })
  it('missing required columns', () => {
    expect(tradesFromCSV('foo,bar\n1,2', CONTRACTS).errors[0]).toMatch(/Missing column/)
  })
  it('merge keeps existing screenshot for matching ids', () => {
    const a = { ...tricky[0], screenshot: 'data:image/jpeg;base64,xx' }
    const { trades, added, updated } = mergeTrades([a], [{ ...tricky[0], notes: 'changed' }, tricky[1]])
    expect(added).toBe(1); expect(updated).toBe(1)
    expect(trades[0].screenshot).toBe(a.screenshot); expect(trades[0].notes).toBe('changed')
  })
})

describe('JSON backup', () => {
  it('round-trips trades (incl. screenshot), custom contracts and strategies', () => {
    const data = {
      trades: [{ ...mk({ symbol: 'ES' }), screenshot: 'data:image/jpeg;base64,abc' }],
      customContracts: [{ ...C.ES, symbol: 'MYX', custom: true }],
      strategies: ['ORB', 'Mine'],
    }
    const b = parseBackup(JSON.stringify(makeBackup(data)))
    expect(b.trades).toEqual(data.trades); expect(b.customContracts).toEqual(data.customContracts); expect(b.strategies).toEqual(data.strategies)
  })
  it('rejects foreign files', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow()
    expect(() => parseBackup('nope')).toThrow()
  })
})
