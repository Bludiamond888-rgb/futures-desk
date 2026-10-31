/** Pure number-pad calculator state machine (session-only; no persistence). */

export type Op = '+' | '-' | '×' | '÷'

export interface CalcState {
  /** Digits currently being typed (or last result after =). */
  display: string
  /** Left operand waiting for the next number, if any. */
  acc: number | null
  /** Pending binary operator. */
  pending: Op | null
  /** After equals / op, the next digit starts a fresh entry. */
  fresh: boolean
  /** Expression line shown above the result, e.g. "12 +". */
  expr: string
  error: boolean
}

export const initialCalc = (): CalcState => ({
  display: '0',
  acc: null,
  pending: null,
  fresh: true,
  expr: '',
  error: false,
})

const MAX_LEN = 14

function formatNum(n: number): string {
  if (!isFinite(n)) return 'Error'
  // Trim floating noise, keep readable length
  let s = String(n)
  if (s.includes('e') || s.includes('E')) {
    s = n.toPrecision(10).replace(/\.?0+e/, 'e').replace(/e\+?/, 'e')
  } else if (s.includes('.')) {
    s = parseFloat(n.toFixed(10)).toString()
  }
  if (s.length > MAX_LEN) {
    s = n.toPrecision(10).replace(/\.?0+$/, '')
    if (s.length > MAX_LEN) s = n.toExponential(6)
  }
  return s
}

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '×': return a * b
    case '÷': return b === 0 ? NaN : a / b
  }
}

function parseDisplay(s: string): number {
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

export function inputDigit(state: CalcState, d: string): CalcState {
  if (state.error) return inputDigit(initialCalc(), d)
  if (state.fresh) {
    return { ...state, display: d, fresh: false, error: false }
  }
  if (state.display === '0' && d !== '.') return { ...state, display: d }
  if (state.display.replace('-', '').replace('.', '').length >= MAX_LEN) return state
  return { ...state, display: state.display + d }
}

export function inputDot(state: CalcState): CalcState {
  if (state.error) return inputDot(initialCalc())
  if (state.fresh) return { ...state, display: '0.', fresh: false, error: false }
  if (state.display.includes('.')) return state
  return { ...state, display: state.display + '.' }
}

export function clearAll(_state?: CalcState): CalcState {
  return initialCalc()
}

export function backspace(state: CalcState): CalcState {
  if (state.error) return initialCalc()
  if (state.fresh) return state
  const next = state.display.slice(0, -1)
  if (!next || next === '-' || next === '-0') return { ...state, display: '0', fresh: true }
  return { ...state, display: next }
}

export function inputOp(state: CalcState, op: Op): CalcState {
  if (state.error) return { ...initialCalc(), pending: op, acc: 0, expr: '0 ' + op, fresh: true }
  const cur = parseDisplay(state.display)
  if (state.acc !== null && state.pending && !state.fresh) {
    const result = apply(state.acc, state.pending, cur)
    if (!isFinite(result)) return { ...initialCalc(), display: 'Error', error: true, expr: '' }
    return {
      display: formatNum(result),
      acc: result,
      pending: op,
      fresh: true,
      expr: formatNum(result) + ' ' + op,
      error: false,
    }
  }
  return {
    ...state,
    acc: cur,
    pending: op,
    fresh: true,
    expr: formatNum(cur) + ' ' + op,
    error: false,
  }
}

export function equals(state: CalcState): CalcState {
  if (state.error) return initialCalc()
  if (state.acc === null || !state.pending) {
    return { ...state, expr: '', fresh: true }
  }
  const cur = parseDisplay(state.display)
  const result = apply(state.acc, state.pending, cur)
  if (!isFinite(result)) {
    return { ...initialCalc(), display: 'Error', error: true, expr: '' }
  }
  const left = formatNum(state.acc)
  const right = formatNum(cur)
  return {
    display: formatNum(result),
    acc: null,
    pending: null,
    fresh: true,
    expr: left + ' ' + state.pending + ' ' + right + ' =',
    error: false,
  }
}

/** Percent: with a pending + or -, x% of the left operand; otherwise x/100. */
export function percent(state: CalcState): CalcState {
  if (state.error) return initialCalc()
  const cur = parseDisplay(state.display)
  const v = state.acc !== null && (state.pending === '+' || state.pending === '-') ? (state.acc * cur) / 100 : cur / 100
  return { ...state, display: formatNum(v), fresh: false }
}

export function negate(state: CalcState): CalcState {
  if (state.error) return initialCalc()
  if (state.display === '0' || state.display === '0.') return state
  const display = state.display.startsWith('-') ? state.display.slice(1) : '-' + state.display
  return { ...state, display, fresh: state.fresh && state.acc === null ? false : state.fresh }
}

/** Load a value (e.g. from history) as the current entry. */
export function loadValue(state: CalcState, v: number): CalcState {
  const base = state.error ? initialCalc() : state
  return { ...base, display: formatNum(v), fresh: true }
}

/** Comma-group the integer part of a display string: "4250.5" -> "4,250.5". */
export function groupDisplay(s: string): string {
  if (!/^-?\d+(\.\d*)?$/.test(s)) return s
  const neg = s.startsWith('-')
  const [i, f] = (neg ? s.slice(1) : s).split('.')
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (neg ? '-' : '') + g + (f !== undefined ? '.' + f : '')
}

/** Group every number inside an expression line. */
export function groupExpr(s: string): string {
  return s.replace(/-?\d+(\.\d*)?/g, (m) => groupDisplay(m))
}

export type CalcAction =
  | { type: 'digit'; d: string }
  | { type: 'dot' }
  | { type: 'clear' }
  | { type: 'back' }
  | { type: 'op'; op: Op }
  | { type: 'eq' }
  | { type: 'pct' }
  | { type: 'neg' }
  | { type: 'use'; v: number }

export function reduceCalc(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {
    case 'digit': return inputDigit(state, action.d)
    case 'dot': return inputDot(state)
    case 'clear': return clearAll()
    case 'back': return backspace(state)
    case 'op': return inputOp(state, action.op)
    case 'eq': return equals(state)
    case 'pct': return percent(state)
    case 'neg': return negate(state)
    case 'use': return loadValue(state, action.v)
  }
}
