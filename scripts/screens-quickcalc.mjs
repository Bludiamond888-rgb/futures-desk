// 16 Pro Max home-screen simulation (440x956 @3x, safe areas 62/34) of every tab. Usage: npm run build && node scripts/screens-rebuild.mjs
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { server, url } = await serve(path.join(root, 'dist'))
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], viewport: { width: 430, height: 932 }, screen: { width: 430, height: 932 }, deviceScaleFactor: 3, serviceWorkers: 'block', timezoneId: 'America/New_York' })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
await p.addInitScript((sa) => { document.addEventListener('DOMContentLoaded', () => {
  const fix = () => { for (const sh of document.styleSheets) { try { for (const r of [...sh.cssRules]) walk(r) } catch {} } }
  function walk(r) { if (r.cssRules) for (const c of r.cssRules) walk(c); if (r.style && r.style.cssText.includes('safe-area-inset')) r.style.cssText = r.style.cssText.replace(/env\(safe-area-inset-top\)/g, sa.top + 'px').replace(/env\(safe-area-inset-bottom\)/g, sa.bottom + 'px').replace(/env\(safe-area-inset-(left|right)\)/g, '0px') }
  fix(); new MutationObserver(fix).observe(document.head, { childList: true })
}) }, { top: Number(59), bottom: 34 })
const shot = async (n, full = false) => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(root, 'screens', `quickcalc-${n}.png`), fullPage: full }) }

await p.goto(url + '#/journal'); await p.waitForSelector('.j-head'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.j-head')
await shot('01-entry-button')
await p.click('[data-testid=open-quickcalc]'); await p.waitForSelector('[data-testid=quickcalc]')
const h = async () => p.evaluate(() => { const r = document.querySelector('.modal').getBoundingClientRect(); return `${Math.round(r.top)}/${Math.round(r.height)}` })
const hEmpty = await h(); await shot('02-empty')
for (const k of ['4','2','5','0','dot','5','mul','2','eq']) await p.click(`[data-testid=qc-${k}]`)
const hAfter = await h(); console.log('result', await p.textContent('[data-testid=qc-result]'), 'sheet', hEmpty, hAfter, hEmpty === hAfter ? 'NO SHIFT' : 'SHIFTED')
if (hEmpty !== hAfter) process.exitCode = 1
await shot('04-after-calc')
for (const k of ['clear','5','mul','neg','3','eq']) await p.click(`[data-testid=qc-${k}]`)
const r = await p.textContent('[data-testid=qc-result]'), e = await p.textContent('[data-testid=qc-expr]'); console.log('neg', e, r); if (r !== '−15') process.exitCode = 1
await shot('05-negative-5x-3')
await p.click('[data-testid=qc-history]'); await p.waitForSelector('[data-testid=qc-hist]'); const hH = await h(); console.log('history sheet', hH, hH === hEmpty ? 'NO SHIFT' : 'SHIFTED'); if (hH !== hEmpty) process.exitCode = 1
await shot('06-history-open')
const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); console.log('h-overflow', ov)
console.log('errors', errors)
await b.close(); server.close()
