import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContractSpec } from '../data/types'

interface Props {
  contracts: ContractSpec[]
  value: ContractSpec | undefined
  onChange: (c: ContractSpec) => void
}

export function matchContract(c: ContractSpec, q: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    c.symbol.toLowerCase().includes(s) ||
    c.name.toLowerCase().includes(s) ||
    c.exchange.toLowerCase().includes(s) ||
    c.category.toLowerCase().includes(s)
  )
}

/** Rank exact / prefix symbol matches first. */
function rank(c: ContractSpec, q: string) {
  const s = q.toLowerCase(), sym = c.symbol.toLowerCase()
  if (sym === s) return 0
  if (sym.startsWith(s)) return 1
  if (c.name.toLowerCase().startsWith(s)) return 2
  return 3
}

export function ContractPicker({ contracts, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const r = contracts.filter((c) => matchContract(c, q.trim()))
    return q.trim() ? r.sort((a, b) => rank(a, q.trim()) - rank(b, q.trim())) : r
  }, [contracts, q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => setHi(0), [q])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const pick = (c: ContractSpec) => {
    onChange(c)
    setOpen(false)
    setQ('')
    input.current?.blur()
  }

  return (
    <div className="picker" ref={wrap}>
      <div className={`picker-control ${open ? 'is-open' : ''}`} onClick={() => { setOpen(true); input.current?.focus() }}>
        {!open && value ? (
          <div className="picker-value">
            <span className="sym">{value.symbol}</span>
            <span className="nm">{value.name}</span>
            <span className="ex">{value.exchange}</span>
          </div>
        ) : null}
        <input
          ref={input}
          className={`picker-input ${!open && value ? 'hidden-input' : ''}`}
          placeholder="Search symbol or name…  e.g. MNQ, gold, bund"
          value={q}
          aria-label="Search contracts"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (results[hi]) pick(results[hi]) }
            else if (e.key === 'Escape') { setOpen(false); setQ(''); input.current?.blur() }
          }}
        />
        <span className="chev" aria-hidden>▾</span>
      </div>
      {open && (
        <ul className="picker-list" ref={list} role="listbox">
          {results.length === 0 && <li className="empty">No contracts match “{q}”</li>}
          {results.map((c, i) => (
            <li
              key={c.symbol}
              data-i={i}
              role="option"
              aria-selected={value?.symbol === c.symbol}
              className={`${i === hi ? 'hi' : ''} ${value?.symbol === c.symbol ? 'sel' : ''}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
            >
              <span className="sym">{c.symbol}</span>
              <span className="nm">{c.name}</span>
              <span className="ex">{c.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
