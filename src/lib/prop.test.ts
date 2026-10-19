import { describe, expect, it } from 'vitest'
import type { Trade } from '../data/types'
import { PROP_FIRMS, PROP_PRESETS, PRESET_BY_ID, CUSTOM_RULES, type PropRules } from '../data/propFirms'
import { CONTRACT_BY_SYMBOL } from '../data/contracts'
import { accountFromPreset, computeProp, isMicro, maxContractsFor, riskCheck, sessionDate, type PropAccount } from './prop'
import { makeBackup, parseBackup } from './backup'
import { tradesFromCSV, tradesToCSV } from './csv'
import { CONTRACTS } from '../data/contracts'
import { samplePropData } from './sample'

// "Now" = Wednesday 2026-10-14 11:00 local, so the 12th/13th are completed sessions.
const NOW = new Date(2026, 9, 14, 11, 0)
let seq = 0
/** A $1-per-point USD trade so `net` is exact. */
function tr(datetime: string, net: number, accountId = 'A', extra: Partial<Trade> = {}): Trade {
  seq++
  return {
    id: `t${seq}`, datetime, symbol: 'TEST', side: 'long', qty: 1, entry: 100, exit: 100 + net, stop: null, fees: 0,
    strategy: '', notes: '', tickSize: 1, tickValue: 1, currency: 'USD', accountId,
    createdAt: `2026-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`, updatedAt: '', ...extra,
  }
}
function acct(rules: Partial<PropRules>, extra: Partial<PropAccount> = {}): PropAccount {
  return {
    id: 'A', name: 'Test', firmId: 'custom', presetId: null, program: 'Custom rules', size: 50000, phase: 'evaluation',
    startDate: '2026-10-01', startingBalance: 50000, status: 'active',
    rules: { ...CUSTOM_RULES, profitTarget: 3000, maxDrawdown: 2000, drawdownType: 'eod', trailLockOffset: null, ...rules },
    createdAt: '', updatedAt: '', ...extra,
  }
}

describe('sessionDate', () => {
  it('rolls at 6 PM and skips the weekend', () => {
    expect(sessionDate('2026-10-13T17:59')).toBe('2026-10-13')
    expect(sessionDate('2026-10-13T18:00')).toBe('2026-10-14')
    expect(sessionDate('2026-10-16T18:30')).toBe('2026-10-19') // Friday evening → Monday
    expect(sessionDate('2026-10-18T18:05')).toBe('2026-10-19') // Sunday open → Monday
    expect(sessionDate('2026-10-17')).toBe('2026-10-19')
  })
})

describe('static drawdown', () => {
  it('never moves and breaches at the fixed floor', () => {
    const a = acct({ drawdownType: 'static', maxDrawdown: 1000 }, { startingBalance: 25000 })
    let s = computeProp(a, [tr('2026-10-12T10:00', 1500), tr('2026-10-13T10:00', 500)], NOW)
    expect(s.threshold).toBe(24000)
    expect(s.balance).toBe(27000)
    expect(s.distanceToDD).toBe(3000)
    expect(s.lockLevel).toBeNull()
    s = computeProp(a, [tr('2026-10-12T10:00', -1000)], NOW)
    expect(s.health).toBe('breached')
    expect(s.breachedAt).toBe('2026-10-12T10:00')
  })
})

describe('EOD trailing drawdown', () => {
  const a = acct({ drawdownType: 'eod', maxDrawdown: 2000 })
  it('trails the highest session close, not intraday highs, and never moves down', () => {
    const s = computeProp(a, [
      tr('2026-10-08T09:30', 1500), tr('2026-10-08T11:00', -700), // close 50,800 (intraday high 51,500 ignored)
      tr('2026-10-09T10:00', 800), // close 51,600
      tr('2026-10-12T10:00', -700), // close 50,900 → stays
    ], NOW)
    expect(s.series.map((p) => p.threshold)).toEqual([48800, 49600, 49600])
    expect(s.threshold).toBe(49600)
    expect(s.distanceToDD).toBe(1300)
  })
  it('does not trail on the session that is still open today', () => {
    const s = computeProp(a, [tr('2026-10-14T09:45', 1500)], NOW)
    expect(s.threshold).toBe(48000)
    expect(s.todayPnl).toBe(1500)
  })
  it('locks at start + offset (e.g. +$100) and at the starting balance (offset 0)', () => {
    const trades = [tr('2026-10-08T10:00', 2500), tr('2026-10-09T10:00', 1000)]
    expect(computeProp(acct({ trailLockOffset: 100 }), trades, NOW).threshold).toBe(50100)
    const s0 = computeProp(acct({ trailLockOffset: 0 }), trades, NOW)
    expect(s0.threshold).toBe(50000)
    expect(s0.locked).toBe(true)
    expect(computeProp(acct({ trailLockOffset: null }), trades, NOW).threshold).toBe(51500)
  })
  it('detects an intraday breach of the EOD level from a closed trade', () => {
    const s = computeProp(a, [tr('2026-10-08T10:00', 1000), tr('2026-10-09T10:00', -3000)], NOW)
    expect(s.health).toBe('breached')
    expect(s.breachedAt).toBe('2026-10-09T10:00')
  })
})

describe('intraday trailing drawdown (closed-trade peak approximation)', () => {
  const a = acct({ drawdownType: 'intraday', maxDrawdown: 2000, trailLockOffset: 100 })
  it('trails every new closed-trade peak within the day and never moves down', () => {
    const s = computeProp(a, [tr('2026-10-12T09:35', 900), tr('2026-10-12T10:10', -600), tr('2026-10-12T11:00', 300)], NOW)
    expect(s.threshold).toBe(48900) // peak 50,900
    expect(s.balance).toBe(50600)
  })
  it('stops trailing at start + $100 (Apex PA style)', () => {
    const s = computeProp(a, [tr('2026-10-12T09:35', 2500), tr('2026-10-13T10:10', 1500)], NOW)
    expect(s.threshold).toBe(50100)
    expect(s.locked).toBe(true)
  })
  it('breaches when a later trade closes at/below the trailed level', () => {
    const s = computeProp(a, [tr('2026-10-12T09:35', 1000), tr('2026-10-12T10:00', -2000)], NOW)
    expect(s.threshold).toBe(49000)
    expect(s.health).toBe('breached')
  })
})

describe('daily loss limit', () => {
  const a = acct({ dailyLossLimit: 1000 })
  it('computes today’s P&L and room left', () => {
    const s = computeProp(a, [tr('2026-10-13T10:00', 400), tr('2026-10-14T09:40', -300), tr('2026-10-14T10:20', -200)], NOW)
    expect(s.todayPnl).toBe(-500)
    expect(s.dllRoom).toBe(500)
    expect(s.health).toBe('ok')
  })
  it('profit today adds room; evening trades count toward the next session', () => {
    const s = computeProp(a, [tr('2026-10-14T09:40', 300), tr('2026-10-13T19:00', -100)], NOW)
    expect(s.todayPnl).toBe(200)
    expect(s.dllRoom).toBe(1200)
  })
  it('warns within 25% and breaches when hit', () => {
    expect(computeProp(a, [tr('2026-10-14T09:40', -800)], NOW).health).toBe('warning')
    const s = computeProp(a, [tr('2026-10-14T09:40', -1000)], NOW)
    expect(s.dllRoom).toBe(0)
    expect(s.health).toBe('breached')
    expect(s.reasons.join(' ')).toMatch(/Daily loss limit/)
  })
  it('no DLL → room is null', () => {
    expect(computeProp(acct({ dailyLossLimit: null }), [], NOW).dllRoom).toBeNull()
  })
})

describe('consistency, target, trading days, status', () => {
  it('largest day ÷ total profit, with the profit needed to comply', () => {
    const a = acct({ consistencyPct: 50, profitTarget: 3000 })
    const s = computeProp(a, [tr('2026-10-08T10:00', 2000), tr('2026-10-09T10:00', 600), tr('2026-10-12T10:00', 500)], NOW)
    expect(s.largestDay).toBe(2000)
    expect(s.consistencyPct).toBeCloseTo((2000 / 3100) * 100, 6)
    expect(s.consistencyOk).toBe(false)
    expect(s.consistencyNeeded).toBe(4000)
    expect(s.health).toBe('warning') // target reached but consistency not met
    expect(s.targetProgress).toBeCloseTo(3100 / 3000)
  })
  it('losing days reduce total profit (Apex example: 1000 / 800)', () => {
    const s = computeProp(acct({ consistencyPct: 50 }), [tr('2026-10-08T10:00', 1000), tr('2026-10-09T10:00', -200)], NOW)
    expect(s.consistencyPct).toBeCloseTo(125)
  })
  it('no profit → consistency undefined and not ok', () => {
    const s = computeProp(acct({ consistencyPct: 40 }), [tr('2026-10-08T10:00', -100)], NOW)
    expect(s.consistencyPct).toBeNull()
    expect(s.consistencyOk).toBe(false)
  })
  it('target reached with rules met → target; min days enforced', () => {
    const rules = { consistencyPct: 55, minTradingDays: 2, profitTarget: 3000 }
    const two = [tr('2026-10-08T10:00', 1600), tr('2026-10-09T10:00', 1500)]
    expect(computeProp(acct(rules), two, NOW).health).toBe('target')
    const one = computeProp(acct({ ...rules, consistencyPct: null }), [tr('2026-10-08T10:00', 3200)], NOW)
    expect(one.tradingDays).toBe(1)
    expect(one.minDaysOk).toBe(false)
    expect(one.health).toBe('warning')
  })
  it('warns within 25% of the drawdown limit', () => {
    const s = computeProp(acct({ maxDrawdown: 2000 }), [tr('2026-10-08T10:00', -1600)], NOW)
    expect(s.distanceToDD).toBe(400)
    expect(s.health).toBe('warning')
  })
  it('ignores other accounts, pre-start sessions and non-USD trades (counted as skipped)', () => {
    const s = computeProp(acct({}), [
      tr('2026-10-08T10:00', 100), tr('2026-10-08T10:00', 999, 'B'), tr('2026-09-30T10:00', 999),
      tr('2026-10-08T11:00', 999, 'A', { currency: 'EUR' }),
    ], NOW)
    expect(s.balance).toBe(50100)
    expect(s.skipped).toBe(1)
    expect(s.tradeCount).toBe(1)
  })
  it('uses net P&L after fees', () => {
    const s = computeProp(acct({}), [tr('2026-10-08T10:00', 100, 'A', { fees: 4.5 })], NOW)
    expect(s.balance).toBeCloseTo(50095.5)
  })
})

describe('calculator risk check', () => {
  it('reports risk and what is left before each limit', () => {
    const c = riskCheck({ riskPerContract: 150, qty: 2, ddRoom: 1550, dllRoom: 550, maxContracts: 6 })
    expect(c.risk).toBe(300)
    expect(c.leftDD).toBe(1250)
    expect(c.leftDLL).toBe(250)
    expect(c.breachDD || c.breachDLL).toBe(false)
    expect(c.maxByRoom).toBe(3) // 3×150 = 450 < 550; 4×150 = 600 ≥ 550
    expect(c.overMax).toBe(false)
  })
  it('warns when a stop-out would breach (touching counts) and caps by account max', () => {
    const c = riskCheck({ riskPerContract: 275, qty: 2, ddRoom: 2000, dllRoom: 550, maxContracts: 1 })
    expect(c.leftDLL).toBe(0)
    expect(c.breachDLL).toBe(true)
    expect(c.breachDD).toBe(false)
    expect(c.maxByRoom).toBe(1)
    expect(c.overMax).toBe(true)
    expect(riskCheck({ riskPerContract: 500, qty: 5, ddRoom: 2000, dllRoom: null, maxContracts: null }).breachDD).toBe(true)
  })
  it('max contracts uses micros for micro contracts', () => {
    const rules = { ...CUSTOM_RULES, maxMinis: 4, maxMicros: 40 }
    expect(isMicro(CONTRACT_BY_SYMBOL.MNQ)).toBe(true)
    expect(isMicro(CONTRACT_BY_SYMBOL.NQ)).toBe(false)
    expect(maxContractsFor(rules, CONTRACT_BY_SYMBOL.MNQ)).toBe(40)
    expect(maxContractsFor(rules, CONTRACT_BY_SYMBOL.ES)).toBe(4)
    expect(maxContractsFor({ ...rules, maxMicros: null }, CONTRACT_BY_SYMBOL.MES)).toBe(40)
  })
})

describe('presets', () => {
  it('cover every firm with source, date and unique ids', () => {
    const ids = new Set(PROP_PRESETS.map((p) => p.id))
    expect(ids.size).toBe(PROP_PRESETS.length)
    for (const f of PROP_FIRMS) expect(PROP_PRESETS.some((p) => p.firmId === f.id)).toBe(true)
    for (const p of PROP_PRESETS) {
      expect(p.sourceUrl).toMatch(/^https:\/\//)
      expect(p.lastVerified).toBe('2026-10-18')
      expect(p.rules.maxDrawdown).toBeGreaterThan(0)
      if (p.verification !== 'verified') expect(p.unverified).toBeTruthy()
    }
  })
  it('offer 50K and 150K for each firm (ETF tops out at 100K/250K on these plans)', () => {
    for (const f of PROP_FIRMS) {
      const sizes = new Set(PROP_PRESETS.filter((p) => p.firmId === f.id).map((p) => p.size))
      expect(sizes.has(50000)).toBe(true)
      if (f.id !== 'etf') expect(sizes.has(150000)).toBe(true)
    }
  })
  it('spot-check official numbers', () => {
    const t = PRESET_BY_ID['topstep-trading-combine-eval-150k'].rules
    expect([t.profitTarget, t.maxDrawdown, t.drawdownType, t.trailLockOffset, t.consistencyPct, t.maxMinis]).toEqual([9000, 4500, 'eod', 0, 55, 15])
    const a = PRESET_BY_ID['apex-intraday-trailing-funded-50k'].rules
    expect([a.maxDrawdown, a.drawdownType, a.trailLockOffset]).toEqual([2000, 'intraday', 100])
    expect(PRESET_BY_ID['etf-static-eval-25k'].rules.drawdownType).toBe('static')
  })
  it('accountFromPreset copies rules (editable without touching the preset)', () => {
    const p = PRESET_BY_ID['mffu-builder-eval-50k']
    const a = accountFromPreset(p, { startDate: '2026-10-01' })
    a.rules.maxDrawdown = 1500
    expect(p.rules.maxDrawdown).toBe(2000)
    expect(a.startingBalance).toBe(50000)
    expect(a.sourceUrl).toBe(p.sourceUrl)
  })
})

describe('backup + CSV with prop accounts', () => {
  it('round-trips prop accounts in the JSON backup and still restores v1 files', () => {
    const acc = accountFromPreset(PRESET_BY_ID['apex-eod-trailing-eval-50k'], { startDate: '2026-10-01' })
    const b = parseBackup(JSON.stringify(makeBackup({ trades: [], customContracts: [], strategies: [], propAccounts: [acc] })))
    expect(b.version).toBe(2)
    expect(b.propAccounts).toEqual([acc])
    const v1 = parseBackup(JSON.stringify({ app: 'futures-desk', version: 1, exportedAt: '', trades: [], customContracts: [], strategies: [] }))
    expect(v1.propAccounts).toEqual([])
    expect(() => parseBackup(JSON.stringify({ app: 'futures-desk', version: 2, exportedAt: '', trades: [], customContracts: [], strategies: [], propAccounts: [{ id: 1 }] }))).toThrow()
  })
  it('keeps accountId through CSV export/import', () => {
    const t = { ...tr('2026-10-08T10:00', 50, 'acct-xyz'), symbol: 'ES', tickSize: 0.25, tickValue: 12.5 }
    const back = tradesFromCSV(tradesToCSV([t]), CONTRACTS).trades[0]
    expect(back.accountId).toBe('acct-xyz')
    const none = tradesFromCSV(tradesToCSV([{ ...t, accountId: undefined }]), CONTRACTS).trades[0]
    expect('accountId' in none).toBe(false)
  })
})

describe('sample prop data', () => {
  it('is clearly labelled and exercises every status', () => {
    const { accounts, trades } = samplePropData(NOW)
    expect(accounts.every((a) => a.sample && a.name.startsWith('SAMPLE'))).toBe(true)
    expect(trades.every((t) => t.sample && t.notes.startsWith('SAMPLE DATA'))).toBe(true)
    const health = accounts.map((a) => computeProp(a, trades, NOW).health)
    expect(new Set(health)).toEqual(new Set(['ok', 'warning', 'target']))
  })
})
