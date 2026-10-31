import { useEffect, useReducer, useRef, useState } from 'react'
import { Modal } from './Modal'
import { groupDisplay, groupExpr, initialCalc, reduceCalc, type CalcAction } from '../lib/numpad'

type K = { label: string; aria: string; action: CalcAction; cls?: string; id: string }
const d = (n: string): K => ({ label: n, aria: n, action: { type: 'digit', d: n }, id: n })
const KEYS: K[] = [
  { label: 'AC', aria: 'All clear', action: { type: 'clear' }, cls: 'fn', id: 'clear' },
  { label: '+/−', aria: 'Toggle sign', action: { type: 'neg' }, cls: 'fn', id: 'neg' },
  { label: '%', aria: 'Percent', action: { type: 'pct' }, cls: 'fn', id: 'pct' },
  { label: '÷', aria: 'Divide', action: { type: 'op', op: '÷' }, cls: 'op', id: 'div' },
  d('7'), d('8'), d('9'),
  { label: '×', aria: 'Multiply', action: { type: 'op', op: '×' }, cls: 'op', id: 'mul' },
  d('4'), d('5'), d('6'),
  { label: '−', aria: 'Subtract', action: { type: 'op', op: '-' }, cls: 'op', id: 'sub' },
  d('1'), d('2'), d('3'),
  { label: '+', aria: 'Add', action: { type: 'op', op: '+' }, cls: 'op', id: 'add' },
  { label: '⌫', aria: 'Backspace', action: { type: 'back' }, cls: 'fn', id: 'back' },
  d('0'),
  { label: '.', aria: 'Decimal point', action: { type: 'dot' }, id: 'dot' },
  { label: '=', aria: 'Equals', action: { type: 'eq' }, cls: 'eq', id: 'eq' },
]
const HKEY = 'futures-calc.quickcalc.history'
type H = { expr: string; v: number }
const loadH = (): H[] => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]') } catch { return [] } }

export default function QuickCalc({ onClose }: { onClose: () => void }) {
  const [s, dispatch] = useReducer(reduceCalc, undefined, initialCalc)
  const [hist, setHist] = useState<H[]>(loadH)
  const [copied, setCopied] = useState(false)
  const last = useRef('')

  useEffect(() => {
    if (s.expr.endsWith('=') && !s.error && last.current !== s.expr + s.display) {
      last.current = s.expr + s.display
      setHist((h) => { const n = [{ expr: s.expr, v: parseFloat(s.display) }, ...h].slice(0, 8); try { localStorage.setItem(HKEY, JSON.stringify(n)) } catch { /* ignore */ } return n })
    }
  }, [s])

  useEffect(() => {
    const map: Record<string, CalcAction> = { '+': { type: 'op', op: '+' }, '-': { type: 'op', op: '-' }, '*': { type: 'op', op: '×' }, x: { type: 'op', op: '×' }, '/': { type: 'op', op: '÷' }, '=': { type: 'eq' }, Enter: { type: 'eq' }, Backspace: { type: 'back' }, '.': { type: 'dot' }, '%': { type: 'pct' }, c: { type: 'clear' } }
    const on = (e: KeyboardEvent) => { const a = /^\d$/.test(e.key) ? { type: 'digit', d: e.key } as CalcAction : map[e.key]; if (a) { e.preventDefault(); dispatch(a) } }
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  const copy = async () => {
    if (s.error) return
    try { await navigator.clipboard.writeText(s.display); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* unsupported */ }
  }
  const shown = groupDisplay(s.display)

  return (
    <Modal title="Calculator" onClose={onClose}>
      <div className="qc" data-testid="quickcalc">
        <button type="button" className="qc-display" onClick={copy} aria-label={`Result ${shown}. Tap to copy`} aria-live="polite">
          <span className="qc-expr" data-testid="qc-expr">{groupExpr(s.expr) || '\u00a0'}</span>
          <span className={'qc-result' + (s.error ? ' err' : '') + (shown.length > 12 ? ' sm' : '')} data-testid="qc-result">{shown}</span>
          <span className="qc-hint">{copied ? 'Copied' : 'Tap result to copy'}</span>
        </button>
        <div className="qc-pad" role="group" aria-label="Keypad">
          {KEYS.map((k) => (
            <button key={k.id} type="button" className={'qc-key' + (k.cls ? ' ' + k.cls : '')} aria-label={k.aria} data-testid={'qc-' + k.id} onClick={() => dispatch(k.action)}>{k.label}</button>
          ))}
        </div>
        {hist.length > 0 && (
          <section className="qc-hist" aria-label="Recent results">
            <div className="qc-hist-head"><span>Recent</span><button type="button" className="linkish" onClick={() => { setHist([]); localStorage.removeItem(HKEY) }}>Clear</button></div>
            {hist.map((h, i) => (
              <button key={i} type="button" className="qc-hist-row" onClick={() => dispatch({ type: 'use', v: h.v })} aria-label={`Use ${h.v}`}>
                <span>{groupExpr(h.expr)}</span><b>{groupDisplay(String(h.v))}</b>
              </button>
            ))}
          </section>
        )}
      </div>
    </Modal>
  )
}
