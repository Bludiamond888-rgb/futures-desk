import { useMemo, useRef, useState } from 'react'
import { allInCost, parsePriceFile, PRESET_SIZES, rankForSize, sizeK, type Billing, type PriceEntry } from '../lib/propPrices'
import { formatMoney } from '../lib/calc'
import { downloadText, stamp } from '../lib/backup'
import { Modal, ConfirmDialog } from '../components/Modal'
import { IconEdit, IconTrash } from '../components/Icons'

interface Props {
  prices: PriceEntry[]
  setPrices: (p: PriceEntry[] | ((p: PriceEntry[]) => PriceEntry[])) => void
  size: number
  setSize: (n: number) => void
}
const $ = (n: number) => formatMoney(n, 'USD', 2)
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function PriceForm({ initial, size, onSave, onClose }: { initial: PriceEntry | null; size: number; onSave: (e: PriceEntry) => void; onClose: () => void }) {
  const i = initial
  const [f, setF] = useState({
    firm: i?.firm ?? '', size: i?.size ?? size, customSize: '', evalFee: i ? String(i.evalFee) : '', billing: (i?.billing ?? 'one-time') as Billing,
    activationFee: i ? String(i.activationFee || '') : '', otherFees: i ? String(i.otherFees || '') : '', promoCode: i?.promoCode ?? '',
    discountPct: i ? String(i.discountPct || '') : '', notes: i?.notes ?? '', url: i?.url ?? '', lastChecked: i?.lastChecked ?? today(),
  })
  const [touched, setTouched] = useState(false)
  const isPreset = PRESET_SIZES.includes(f.size)
  const [custom, setCustom] = useState(!isPreset)
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s))
  const sizeVal = custom ? n(f.customSize || (isPreset ? '' : String(f.size))) : f.size
  const errs: Record<string, string> = {}
  if (!f.firm.trim()) errs.firm = 'Required'
  if (f.evalFee.trim() === '' || !(n(f.evalFee) >= 0)) errs.evalFee = 'Enter a price'
  if (!(sizeVal > 0)) errs.size = 'Enter a size'
  for (const k of ['activationFee', 'otherFees'] as const) if (!(n(f[k]) >= 0)) errs[k] = 'Invalid'
  if (!(n(f.discountPct) >= 0 && n(f.discountPct) <= 100)) errs.discountPct = '0–100'
  const c = allInCost({ evalFee: n(f.evalFee) || 0, discountPct: n(f.discountPct) || 0, activationFee: n(f.activationFee) || 0, otherFees: n(f.otherFees) || 0 })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const err = (k: string) => (touched && errs[k] ? <span className="ferr">{errs[k]}</span> : null)
  const save = () => {
    setTouched(true)
    if (Object.keys(errs).length) return
    onSave({
      ...(i ?? {}), id: i?.id ?? `pp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      firm: f.firm.trim(), size: sizeVal, evalFee: n(f.evalFee), billing: f.billing, activationFee: n(f.activationFee), otherFees: n(f.otherFees),
      promoCode: f.promoCode.trim(), discountPct: n(f.discountPct), notes: f.notes, url: f.url.trim(), lastChecked: f.lastChecked,
    })
  }
  return (
    <Modal title={i ? 'Edit firm price' : 'Add firm price'} onClose={onClose} wide footer={<>
      <span className="foot-pnl">All-in <b className="mono">{$(c.total)}</b></span>
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={save}>{i ? 'Save' : 'Add firm'}</button>
    </>}>
      <form className="trade-form pp-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="tf-grid">
          <label className="span2">Firm name {err('firm')}<input name="firm" value={f.firm} onChange={set('firm')} placeholder="e.g. Topstep" /></label>
          <div className="lbl span2">Account size {err('size')}
            <div className="chips pp-chips">
              {PRESET_SIZES.map((s) => <button key={s} type="button" className={`chip ${!custom && f.size === s ? 'on' : ''}`} onClick={() => { setCustom(false); setF({ ...f, size: s }) }}>{sizeK(s)}</button>)}
              <button type="button" className={`chip ${custom ? 'on' : ''}`} onClick={() => setCustom(true)}>Custom</button>
            </div>
            {custom && <input name="customSize" inputMode="numeric" placeholder="Account size in $" value={f.customSize || (isPreset ? '' : String(f.size))} onChange={set('customSize')} />}
          </div>
          <label><span className="lt">Evaluation fee <small>($, list price)</small></span><input name="evalFee" inputMode="decimal" value={f.evalFee} onChange={set('evalFee')} />{err('evalFee')}</label>
          <div className="lbl">Billing
            <div className="seg" role="radiogroup" aria-label="Billing">
              {(['one-time', 'monthly'] as Billing[]).map((b) => <button key={b} type="button" role="radio" aria-checked={f.billing === b} className={f.billing === b ? 'on' : ''} onClick={() => setF({ ...f, billing: b })}>{b === 'monthly' ? 'Monthly' : 'One-time'}</button>)}
            </div>
          </div>
          <label><span className="lt">Activation / reset fee <small>($)</small></span><input name="activationFee" inputMode="decimal" value={f.activationFee} onChange={set('activationFee')} placeholder="0" />{err('activationFee')}</label>
          <label><span className="lt">Required data / other fees <small>($)</small></span><input name="otherFees" inputMode="decimal" value={f.otherFees} onChange={set('otherFees')} placeholder="0" />{err('otherFees')}</label>
          <label><span className="lt">Promo / discount code</span><input name="promoCode" value={f.promoCode} onChange={set('promoCode')} placeholder="optional" /></label>
          <label><span className="lt">Discount <small>(% off evaluation)</small></span><input name="discountPct" inputMode="decimal" value={f.discountPct} onChange={set('discountPct')} placeholder="0" />{err('discountPct')}</label>
          <label><span className="lt">Website</span><input name="url" type="url" value={f.url} onChange={set('url')} placeholder="https://" /></label>
          <label><span className="lt">Last checked</span><input name="lastChecked" type="date" value={f.lastChecked} onChange={set('lastChecked')} /></label>
          <label className="span2">Notes<textarea name="notes" rows={3} value={f.notes} onChange={set('notes')} /></label>
        </div>
      </form>
    </Modal>
  )
}

export function PropPrices({ prices, setPrices, size, setSize }: Props) {
  const [form, setForm] = useState<{ e: PriceEntry | null } | null>(null)
  const [del, setDel] = useState<PriceEntry | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const ranked = useMemo(() => rankForSize(prices, size), [prices, size])
  const sizes = [...new Set([...PRESET_SIZES, ...prices.map((p) => p.size)])].sort((a, b) => a - b)
  const count = (s: number) => prices.filter((p) => p.size === s).length
  const best = ranked[0]?.c.total

  return (
    <div className="pprices">
      <div className="pp-top panel">
        <span className="field-label">Account size</span>
        <div className="chips pp-sizes" role="radiogroup" aria-label="Account size">
          {sizes.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} className={`chip big ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>
              {sizeK(s)} <span className="n">{count(s)}</span>
            </button>
          ))}
        </div>
        <div className="pp-actions">
          <button type="button" className="btn primary" onClick={() => setForm({ e: null })}>+ Add firm</button>
          <button type="button" className="btn sm" disabled={!prices.length}
            onClick={() => downloadText(`futures-desk-prop-prices-${stamp()}.json`, JSON.stringify({ app: 'futures-desk-prop-prices', version: 1, exportedAt: new Date().toISOString(), prices }, null, 1), 'application/json')}>Export JSON</button>
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (ev) => {
            const file = ev.target.files?.[0]; ev.target.value = ''
            if (!file) return
            try { const list = parsePriceFile(await file.text()); setPrices(list); setMsg({ kind: 'ok', text: `Imported ${list.length} price entries.` }) }
            catch (e) { setMsg({ kind: 'err', text: (e as Error).message }) }
          }} />
        </div>
        {msg && <p className={msg.kind === 'ok' ? 'pos' : 'danger-text'} role="status">{msg.text}</p>}
      </div>

      {prices.some((p) => p.sample) && <p className="sample-note" role="note">Showing SAMPLE price entries for demonstration only — not real prices.</p>}

      {ranked.length === 0 ? (
        <div className="panel placeholder">
          <h2>No {sizeK(size)} prices yet</h2>
          <p>Add a firm's evaluation price, fees and promo code to compare the real all-in cost.</p>
          <button type="button" className="btn primary" onClick={() => setForm({ e: null })}>+ Add firm</button>
        </div>
      ) : (
        <div className="pp-list">
          {ranked.map(({ e, c }, idx) => (
            <article key={e.id} className={`panel pp-card ${c.total === best ? 'best' : ''}`} data-testid="price-card">
              <header className="pp-head">
                <div className="pp-rank mono">#{idx + 1}</div>
                <div className="pp-title">
                  <h3>{e.firm}{e.sample && <span className="badge sample">Sample</span>}</h3>
                  <p className="muted">{sizeK(e.size)} · {e.billing === 'monthly' ? 'Monthly' : 'One-time'}{e.promoCode && <> · code <b className="mono">{e.promoCode}</b></>}</p>
                </div>
                <div className="pp-total">
                  {c.total === best && <span className="badge best-badge">Best price</span>}
                  <b className="mono">{$(c.total)}</b>
                  <small className="muted">all-in{e.billing === 'monthly' ? ' · 1st month' : ''}</small>
                </div>
              </header>
              <div className="pp-formula mono" data-testid="formula">
                <span>{$(c.evalFee)}{c.discountPct > 0 && <> − {c.discountPct}%</>} = {$(c.evalAfter)} <small>eval</small></span>
                <span>+ {$(c.activation)} <small>activation</small></span>
                <span>+ {$(c.other)} <small>fees</small></span>
                <span className="eq">= {$(c.total)}</span>
              </div>
              {e.notes && <details className="pp-notes"><summary>Notes</summary><p>{e.notes}</p></details>}
              <footer className="pp-foot">
                <span className="muted">Checked {e.lastChecked || '—'}{e.source && <span title={e.source}> · from scouting scan</span>}</span>
                <span className="pp-btns">
                  {e.url && <a className="btn sm" href={e.url} target="_blank" rel="noopener noreferrer">Website ↗</a>}
                  <button type="button" className="icon-btn" onClick={() => setForm({ e })} aria-label="Edit price" title="Edit"><IconEdit /></button>
                  <button type="button" className="icon-btn danger" onClick={() => setDel(e)} aria-label="Delete price" title="Delete"><IconTrash /></button>
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}
      <p className="hint">All-in = evaluation × (1 − discount %) + activation/reset + required data/other fees. Monthly plans show the first month only. Prices change often — re-check the firm's site before buying.</p>

      {form && <PriceForm initial={form.e} size={size} onClose={() => setForm(null)} onSave={(e) => {
        setPrices((p) => { const i = p.findIndex((x) => x.id === e.id); if (i < 0) return [...p, e]; const n = p.slice(); n[i] = e; return n })
        setSize(e.size); setForm(null)
      }} />}
      {del && <ConfirmDialog title="Delete price entry?" danger confirmLabel="Delete" message={<>Delete <b>{del.firm}</b> ({sizeK(del.size)})?</>}
        onCancel={() => setDel(null)} onConfirm={() => { const id = del.id; setPrices((p) => p.filter((x) => x.id !== id)); setDel(null) }} />}
    </div>
  )
}
