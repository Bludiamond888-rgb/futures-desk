import { describe, expect, it } from 'vitest'
import { backspace, clearAll, equals, initialCalc, inputDigit, inputDot, inputOp, reduceCalc } from './numpad'
import { groupDisplay, groupExpr } from "./numpad"

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
  it('grouping', () => { expect(groupDisplay('-1234567.89')).toBe('-1,234,567.89'); expect(groupDisplay('Error')).toBe('Error') })
})
