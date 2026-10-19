import { useMemo, useState } from 'react'
import {
  CUSTOM_RULES, DRAWDOWN_LABEL, FIRM_BY_ID, PROP_FIRMS, PRESET_BY_ID, presetsFor, sizeLabel,
  type DrawdownType, type PropPhase, type PropPreset, type PropRules,
} from '../data/propFirms'
import { accountFromPreset, type AccountStatus, type PropAccount } from '../lib/prop'
import { newId } from '../lib/journal'
import { Modal } from './Modal'

interface Props {
  initial: PropAccount | null
  onSave: (a: PropAccount) => void
  onClose: () => void
}

type RuleForm = Record<keyof Omit<PropRules, 'drawdownType' | 'notes'>, string> & { drawdownType: DrawdownType; notes: string }

const s = (n: number | null) => (n == null ? '' : String(n))
const toForm = (r: PropRules): RuleForm => ({
  profitTarget: s(r.profitTarget), maxDrawdown: s(r.maxDrawdown), drawdownType: r.drawdownType,
  trailLockOffset: s(r.trailLockOffset), dailyLossLimit: s(r.dailyLossLimit), consistencyPct: s(r.consistencyPct),
  minTradingDays: s(r.minTradingDays), maxMinis: s(r.maxMinis), maxMicros: s(r.maxMicros), notes: r.notes,
})
const numOrNull = (v: string) => {
  const t = v.replace(/[$,\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function AccountForm({ initial, onSave, onClose }: Props) {
  const initPreset = initial?.presetId ? PRESET_BY_ID[initial.presetId] : undefined
  const [firmId, setFirmId] = useState(initial?.firmId ?? 'apex')
  const [program, setProgram] = useState(initial?.program ?? initPreset?.program ?? presetsFor('apex')[0].program)
  const [phase, setPhase] = useState<PropPhase>(initial?.phase ?? 'evaluation')
  const [size, setSize] = useState(initial?.size ?? 50000)
  const [name, setName] = useState(initial?.name ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? today())
  const [startBal, setStartBal] = useState(initial ? String(initial.startingBalance) : '50000')
  const [status, setStatus] = useState<AccountStatus>(initial?.status ?? 'active')
  const [rules, setRules] = useState<RuleForm>(toForm(initial?.rules ?? presetsFor('apex').find((p) => p.size === 50000)!.rules))
  const [edited, setEdited] = useState(!!initial?.edited)
  const [touched, setTouched] = useState(false)

  const isCustom = firmId === 'custom'
  const firmPresets = useMemo(() => (isCustom ? [] : presetsFor(firmId)), [firmId, isCustom])
  const programs = [...new Set(firmPresets.map((p) => p.program))]
  const phases = [...new Set(firmPresets.filter((p) => p.program === program).map((p) => p.phase))]
  const sizes = firmPresets.filter((p) => p.program === program && p.phase === phase).map((p) => p.size)
  const preset: PropPreset | undefined = firmPresets.find((p) => p.program === program && p.phase === phase && p.size === size)

  /** Pick the closest valid preset after a selector change and load its rules. */
  function choose(next: { firmId?: string; program?: string; phase?: PropPhase; size?: number }) {
    const f = next.firmId ?? firmId
    if (f === 'custom') {
      setFirmId('custom'); setRules(toForm({ ...CUSTOM_RULES, maxDrawdown: Math.round(size * 0.04) })); setEdited(false)
      return
    }
    const list = presetsFor(f)
    const prog = list.some((p) => p.program === (next.program ?? program)) ? (next.program ?? program) : list[0].program
    const ph = list.some((p) => p.program === prog && p.phase === (next.phase ?? phase)) ? (next.phase ?? phase) : list.find((p) => p.program === prog)!.phase
    const cands = list.filter((p) => p.program === prog && p.phase === ph)
    const want = next.size ?? size
    const pick = cands.find((p) => p.size === want) ?? cands.reduce((a, b) => (Math.abs(b.size - want) < Math.abs(a.size - want) ? b : a))
    setFirmId(f); setProgram(prog); setPhase(ph); setSize(pick.size)
    if (!initial || Number(startBal) === size || startBal === '') setStartBal(String(ph === 'funded' && f === 'topstep' ? 0 : pick.size))
    setRules(toForm(pick.rules)); setEdited(false)
  }

  const setRule = (k: keyof RuleForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setRules({ ...rules, [k]: e.target.value }); setEdited(true)
  }

  const parsed = {
    profitTarget: numOrNull(rules.profitTarget), maxDrawdown: numOrNull(rules.maxDrawdown),
    trailLockOffset: numOrNull(rules.trailLockOffset), dailyLossLimit: numOrNull(rules.dailyLossLimit),
    consistencyPct: numOrNull(rules.consistencyPct), minTradingDays: numOrNull(rules.minTradingDays),
    maxMinis: numOrNull(rules.maxMinis), maxMicros: numOrNull(rules.maxMicros),
  }
  const bal = numOrNull(startBal)
  const errors: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed)) {
    if (Number.isNaN(v as number)) errors[k] = 'Number'
    else if (v != null && k !== 'trailLockOffset' && (v as number) < 0) errors[k] = '≥ 0'
  }
  if (parsed.maxDrawdown == null || !((parsed.maxDrawdown as number) > 0)) errors.maxDrawdown = 'Required'
  if (bal == null || Number.isNaN(bal)) errors.startBal = 'Required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.startDate = 'Required'
  if (parsed.consistencyPct != null && (parsed.consistencyPct as number) > 100) errors.consistencyPct = '≤ 100'
  const ok = Object.keys(errors).length === 0
  const err = (k: string) => (touched && errors[k] ? <span className="ferr">{errors[k]}</span> : null)

  function save() {
    setTouched(true)
    if (!ok) return
    const r: PropRules = {
      profitTarget: parsed.profitTarget, maxDrawdown: parsed.maxDrawdown as number, drawdownType: rules.drawdownType,
      trailLockOffset: rules.drawdownType === 'static' ? null : parsed.trailLockOffset,
      dailyLossLimit: parsed.dailyLossLimit, consistencyPct: parsed.consistencyPct, minTradingDays: parsed.minTradingDays,
      maxMinis: parsed.maxMinis, maxMicros: parsed.maxMicros, notes: rules.notes.trim(),
    }
    const now = new Date().toISOString()
    const base = preset && !isCustom ? accountFromPreset(preset, { startDate }) : null
    const a: PropAccount = {
      ...(initial ?? {}),
      id: initial?.id ?? newId(),
      name: name.trim() || base?.name || `Custom ${sizeLabel(size)} ${phase === 'evaluation' ? 'Eval' : 'Funded'}`,
      firmId, presetId: isCustom ? null : preset?.id ?? null,
      program: isCustom ? 'Custom rules' : program, size, phase, startDate,
      startingBalance: bal as number, status, rules: r,
      sourceUrl: isCustom ? undefined : preset?.sourceUrl,
      lastVerified: isCustom ? undefined : preset?.lastVerified,
      verification: isCustom ? 'custom' : preset?.verification,
      unverified: isCustom ? undefined : preset?.unverified,
      edited: isCustom ? false : edited,
      createdAt: initial?.createdAt ?? now, updatedAt: now,
    }
    if (!a.unverified) delete a.unverified
    onSave(a)
  }

  const firmName = isCustom ? 'Custom rules' : FIRM_BY_ID[firmId]?.name

  return (
    <Modal title={initial ? 'Edit prop account' : 'New prop account'} onClose={onClose} wide footer={<>
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      <button type="button" className="btn primary" onClick={save}>{initial ? 'Save changes' : 'Create account'}</button>
    </>}>
      <form className="trade-form acct-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="tf-grid">
          <label>Firm
            <select name="firm" value={firmId} onChange={(e) => choose({ firmId: e.target.value })}>
              {PROP_FIRMS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value="custom">Custom rules…</option>
            </select>
          </label>
          {isCustom ? (
            <label>Account size
              <input inputMode="numeric" name="size" value={String(size)} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); setSize(n); setStartBal(String(n)) }} />
            </label>
          ) : (
            <label>Plan
              <select name="program" value={program} onChange={(e) => choose({ program: e.target.value })}>
                {programs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
          <div className="lbl">Phase
            <div className="seg" role="radiogroup" aria-label="Phase">
              {(['evaluation', 'funded'] as PropPhase[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={phase === p} className={phase === p ? 'on' : ''}
                  disabled={!isCustom && !phases.includes(p)}
                  onClick={() => (isCustom ? setPhase(p) : choose({ phase: p }))}>{p === 'evaluation' ? 'Evaluation' : 'Funded'}</button>
              ))}
            </div>
          </div>
          {!isCustom && (
            <label>Size
              <select name="sizeSel" value={size} onChange={(e) => choose({ size: Number(e.target.value) })}>
                {sizes.map((n) => <option key={n} value={n}>{sizeLabel(n)}</option>)}
              </select>
            </label>
          )}
          <label className={isCustom ? '' : ''}>Name <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${firmName} ${sizeLabel(size)}`} /></label>
          <label>Start date <input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} />{err('startDate')}</label>
          <label><span className="lt">Starting balance <small>($)</small></span>
            <input inputMode="decimal" name="startingBalance" value={startBal} onChange={(e) => setStartBal(e.target.value)} />{err('startBal')}
          </label>
          <label>Status
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
              <option value="active">Active</option><option value="passed">Passed</option><option value="blown">Blown</option>
            </select>
          </label>
        </div>

        {!isCustom && preset && (
          <p className={`src-note ${preset.verification !== 'verified' ? 'partial' : ''}`}>
            {preset.verification === 'verified' ? '✓ Checked against the firm’s page' : '⚠ Partly verified'} on {preset.lastVerified} ·{' '}
            <a href={preset.sourceUrl} target="_blank" rel="noreferrer">source</a>. Rules change often — confirm with your firm.
            {preset.unverified && <><br />Not confirmed: {preset.unverified}</>}
          </p>
        )}

        <h4 className="form-sub">Rules {edited && !isCustom && <span className="badge warn">edited</span>}</h4>
        <div className="tf-grid rules-grid">
          <label><span className="lt">Profit target <small>($, blank = none)</small></span><input inputMode="decimal" name="profitTarget" value={rules.profitTarget} onChange={setRule('profitTarget')} />{err('profitTarget')}</label>
          <label><span className="lt">Max drawdown <small>($)</small></span><input inputMode="decimal" name="maxDrawdown" value={rules.maxDrawdown} onChange={setRule('maxDrawdown')} />{err('maxDrawdown')}</label>
          <label>Drawdown type
            <select name="drawdownType" value={rules.drawdownType} onChange={setRule('drawdownType')}>
              {(Object.keys(DRAWDOWN_LABEL) as DrawdownType[]).map((k) => <option key={k} value={k}>{DRAWDOWN_LABEL[k]}</option>)}
            </select>
          </label>
          <label><span className="lt">Trail stops at start + <small>($, blank = keeps trailing)</small></span>
            <input inputMode="decimal" name="trailLockOffset" value={rules.drawdownType === 'static' ? '' : rules.trailLockOffset} disabled={rules.drawdownType === 'static'} onChange={setRule('trailLockOffset')} placeholder={rules.drawdownType === 'static' ? 'n/a' : 'keeps trailing'} />{err('trailLockOffset')}
          </label>
          <label><span className="lt">Daily loss limit <small>($, blank = none)</small></span><input inputMode="decimal" name="dailyLossLimit" value={rules.dailyLossLimit} onChange={setRule('dailyLossLimit')} />{err('dailyLossLimit')}</label>
          <label><span className="lt">Consistency <small>(max % best day)</small></span><input inputMode="decimal" name="consistencyPct" value={rules.consistencyPct} onChange={setRule('consistencyPct')} placeholder="none" />{err('consistencyPct')}</label>
          <label><span className="lt">Min trading days</span><input inputMode="numeric" name="minTradingDays" value={rules.minTradingDays} onChange={setRule('minTradingDays')} placeholder="none" />{err('minTradingDays')}</label>
          <label><span className="lt">Max contracts <small>(minis / micros)</small></span>
            <div className="pair-in">
              <input inputMode="numeric" name="maxMinis" value={rules.maxMinis} onChange={setRule('maxMinis')} placeholder="—" aria-label="Max minis" />
              <input inputMode="numeric" name="maxMicros" value={rules.maxMicros} onChange={setRule('maxMicros')} placeholder="—" aria-label="Max micros" />
            </div>{err('maxMinis')}{err('maxMicros')}
          </label>
          <label className="span2">Notes (news rules, scaling, etc.)
            <textarea name="ruleNotes" rows={3} value={rules.notes} onChange={setRule('notes')} />
          </label>
        </div>
      </form>
    </Modal>
  )
}
