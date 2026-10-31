import { describe, expect, it } from 'vitest'
import { backspace, clearAll, equals, initialCalc, inputDigit, inputDot, inputOp, reduceCalc } from './numpad'
import { groupDisplay, groupExpr } from "./numpad"
import { loadCalc, saveCalc, reviveCalc, CALC_STATE_KEY } from './numpad'

describe('numpad calculator', () => {
  it('starts at 0', () => {
    expect(initialCalc().display).toBe('0')
  })

  it('enters multi-digit numbers and decimal', () => {
    let s = initialCalc()
    s = inputDigit(s, '1')
    s = inputDigit(s, '2')
    s = inputDot(s)
    s = inputDigit(s, '5')
    expect(s.display).toBe('12.5')
  })

  it('ignores second decimal point', () => {
    let s = inputDigit(initialCalc(), '3')
    s = inputDot(s)
    s = inputDot(s)
    s = inputDigit(s, '1')
    expect(s.display).toBe('3.1')
  })

  it('adds and equals', () => {
    let s = initialCalc()
    s = inputDigit(s, '2')
    s = inputOp(s, '+')
    s = inputDigit(s, '3')
    s = equals(s)
    expect(s.display).toBe('5')
    expect(s.expr).toContain('=')
  })

  it('chains operations (immediate apply)', () => {
    let s = initialCalc()
    s = inputDigit(s, '1')
    s = inputDigit(s, '0')
    s = inputOp(s, '+')
    s = inputDigit(s, '5')
    s = inputOp(s, '×')
    expect(s.display).toBe('15')
    s = inputDigit(s, '2')
    s = equals(s)
    expect(s.display).toBe('30')
  })

  it('subtracts, multiplies, divides', () => {
    let s = inputDigit(initialCalc(), '9')
    s = inputOp(s, '-')
    s = inputDigit(s, '4')
    s = equals(s)
    expect(s.display).toBe('5')

    s = initialCalc()
    s = inputDigit(s, '6')
    s = inputOp(s, '×')
    s = inputDigit(s, '7')
    s = equals(s)
    expect(s.display).toBe('42')

    s = initialCalc()
    s = inputDigit(s, '8')
    s = inputOp(s, '÷')
    s = inputDigit(s, '4')
    s = equals(s)
    expect(s.display).toBe('2')
  })

  it('division by zero shows Error', () => {
    let s = inputDigit(initialCalc(), '1')
    s = inputOp(s, '÷')
    s = inputDigit(s, '0')
    s = equals(s)
    expect(s.error).toBe(true)
    expect(s.display).toBe('Error')
  })

  it('clear resets everything', () => {
    let s = inputDigit(initialCalc(), '9')
    s = inputOp(s, '+')
    s = clearAll(s)
    expect(s).toEqual(initialCalc())
  })

  it('backspace deletes last digit', () => {
    let s = inputDigit(initialCalc(), '1')
    s = inputDigit(s, '2')
    s = inputDigit(s, '3')
    s = backspace(s)
    expect(s.display).toBe('12')
    s = backspace(s)
    s = backspace(s)
    expect(s.display).toBe('0')
    expect(s.fresh).toBe(true)
  })

  it('fresh entry after equals', () => {
    let s = inputDigit(initialCalc(), '4')
    s = inputOp(s, '+')
    s = inputDigit(s, '1')
    s = equals(s)
    s = inputDigit(s, '7')
    expect(s.display).toBe('7')
  })

  it('reduceCalc covers all actions', () => {
    let s = reduceCalc(initialCalc(), { type: 'digit', d: '5' })
    s = reduceCalc(s, { type: 'dot' })
    s = reduceCalc(s, { type: 'digit', d: '5' })
    s = reduceCalc(s, { type: 'op', op: '+' })
    s = reduceCalc(s, { type: 'digit', d: '1' })
    s = reduceCalc(s, { type: 'eq' })
    expect(s.display).toBe('6.5')
    s = reduceCalc(s, { type: 'clear' })
    expect(s.display).toBe('0')
  })
})

describe('futures calc extras', () => {
  const run = (keys: import('./numpad').CalcAction[]) => keys.reduce(reduceCalc, initialCalc())
  const digits = (s: string) => [...s].map((c) => (c === '.' ? { type: 'dot' as const } : { type: 'digit' as const, d: c }))
  it('4250.5 × 2 = 8501', () => {
    const s = run([...digits('4250.5'), { type: 'op', op: '×' }, ...digits('2'), { type: 'eq' }])
    expect(s.display).toBe('8501')
    expect(groupDisplay(s.display)).toBe('8,501')
    expect(groupExpr(s.expr)).toBe('4,250.5 × 2 =')
  })
  it('decimals', () => { expect(run([...digits('0.1'), { type: 'op', op: '+' }, ...digits('0.2'), { type: 'eq' }]).display).toBe('0.3') })
  it('percent', () => {
    expect(run([...digits('50'), { type: 'pct' }]).display).toBe('0.5')
    expect(run([...digits('200'), { type: 'op', op: '+' }, ...digits('10'), { type: 'pct' }, { type: 'eq' }]).display).toBe('220')
  })
  it('negate', () => { expect(run([...digits('5'), { type: 'neg' }]).display).toBe('-5') })
  it('grouping', () => { expect(groupDisplay('-1234567.89')).toBe('−1,234,567.89'); expect(groupDisplay('Error')).toBe('Error') })
})

describe('negative numbers', () => {
  const run = (keys: import('./numpad').CalcAction[]) => keys.reduce(reduceCalc, initialCalc())
  const D = (s: string) => [...s].map((c) => (c === '.' ? { type: 'dot' as const } : { type: 'digit' as const, d: c }))
  const mul = { type: 'op' as const, op: '×' as const }, sub = { type: 'op' as const, op: '-' as const }, add = { type: 'op' as const, op: '+' as const }
  const eq = { type: 'eq' as const }, neg = { type: 'neg' as const }
  it('+/- after operator: 5 × −3 = −15', () => {
    const s = run([...D('5'), mul, neg, ...D('3'), eq])
    expect(s.display).toBe('-15'); expect(groupDisplay(s.display)).toBe('−15'); expect(groupExpr(s.expr)).toBe('5 × −3 =')
  })
  it('− after operator starts a negative number', () => { expect(run([...D('5'), mul, sub, ...D('3'), eq]).display).toBe('-15') })
  it('− at start starts a negative number', () => { expect(run([sub, ...D('4'), add, ...D('10'), eq]).display).toBe('6') })
  it('+/- from 0 at start', () => { expect(run([neg, ...D('2.5'), mul, ...D('2'), eq]).display).toBe('-5') })
  it('+/- toggles current entry', () => { expect(run([...D('7'), neg]).display).toBe('-7'); expect(run([...D('7'), neg, neg]).display).toBe('7') })
  it('negative result displays grouped and chains', () => {
    const s = run([...D('1000'), sub, ...D('2250.5'), eq])
    expect(groupDisplay(s.display)).toBe('−1,250.5')
    expect(run([...D('1000'), sub, ...D('2250.5'), eq, mul, ...D('2'), eq]).display).toBe('-2501')
    expect(run([...D('1000'), sub, ...D('2250.5'), eq, neg]).display).toBe('1250.5')
  })
  it('subtraction still works after =', () => { expect(run([...D('10'), add, ...D('5'), eq, sub, ...D('3'), eq]).display).toBe('12') })
  it('backspace on lone minus', () => { expect(run([...D('5'), mul, neg, { type: 'back' }]).display).toBe('0') })
})

describe('persistence', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, m } }
  const run = (keys: import('./numpad').CalcAction[], s = initialCalc()) => keys.reduce(reduceCalc, s)
  it('round-trips a typed entry', () => {
    const st = mem(); const s = run([{ type: 'digit', d: '4' }, { type: 'digit', d: '2' }, { type: 'dot' }, { type: 'digit', d: '5' }])
    saveCalc(s, st); expect(loadCalc(st)).toEqual(s)
  })
  it('round-trips a pending operation and continues', () => {
    const st = mem(); const s = run([{ type: 'digit', d: '5' }, { type: 'op', op: '×' }, { type: 'neg' }, { type: 'digit', d: '3' }])
    saveCalc(s, st); const back = loadCalc(st)
    expect(back.expr).toBe('5 ×'); expect(reduceCalc(back, { type: 'eq' }).display).toBe('-15')
  })
  it('keeps last result', () => {
    const st = mem(); const s = run([{ type: 'digit', d: '9' }, { type: 'op', op: '+' }, { type: 'digit', d: '1' }, { type: 'eq' }])
    saveCalc(s, st); expect(loadCalc(st).display).toBe('10'); expect(loadCalc(st).expr).toBe('9 + 1 =')
  })
  it('AC state persists as 0', () => { const st = mem(); saveCalc(reduceCalc(run([{ type: 'digit', d: '7' }]), { type: 'clear' }), st); expect(loadCalc(st)).toEqual(initialCalc()) })
  it('garbage falls back to 0', () => {
    const st = mem(); st.m.set(CALC_STATE_KEY, '{bad'); expect(loadCalc(st)).toEqual(initialCalc())
    expect(reviveCalc({ display: 'abc' })).toEqual(initialCalc()); expect(reviveCalc(null)).toEqual(initialCalc())
    expect(loadCalc(undefined)).toEqual(initialCalc())
  })
})
