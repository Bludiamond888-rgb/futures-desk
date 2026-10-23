// 16 Pro Max home-screen simulation (440x956, safe areas 62/34) of the Calculator. Usage: npm run build && node scripts/screens-16pm.mjs
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { server, url } = await serve(path.join(root, 'dist'))
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], viewport: { width: 440, height: 956 }, screen: { width: 440, height: 956 }, serviceWorkers: 'block' })
const p = await ctx.newPage()
await p.addInitScript((sa) => { document.addEventListener('DOMContentLoaded', () => {
  for (const sh of document.styleSheets) { try { for (const r of [...sh.cssRules]) walk(r) } catch {} }
  function walk(r) { if (r.cssRules) for (const c of r.cssRules) walk(c); if (r.style && r.style.cssText.includes('safe-area-inset')) r.style.cssText = r.style.cssText.replace(/env\(safe-area-inset-top\)/g, sa.top + 'px').replace(/env\(safe-area-inset-bottom\)/g, sa.bottom + 'px') }
}) }, { top: 62, bottom: 34 })
const out = (n) => path.join(root, 'screens', n)
let bad = 0
const check = async (state) => {
  await p.evaluate(() => scrollTo(0, 1e6))
  const m = await p.evaluate(() => ({ barTop: Math.round(document.querySelector('.tabs.bottom').getBoundingClientRect().top),
    lastBottom: Math.round(document.querySelector('.calc .inputs').getBoundingClientRect().bottom), fieldH: Math.round(document.querySelector('#tp').getBoundingClientRect().height),
    scrollable: document.scrollingElement.scrollHeight - innerHeight }))
  const ok = m.lastBottom <= m.barTop; if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${state} last card clears tab bar`, JSON.stringify(m))
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: out(`scroll-16promax-pwa-${state}.png`) })
  await p.screenshot({ path: out(`scroll-16promax-pwa-${state}-full.png`), fullPage: true })
}
await p.goto(url + '#/calculator'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#tp')
await check('empty')
await p.click('.picker-control'); await p.fill('.picker-input', 'ES'); await p.keyboard.press('Enter')
await p.fill('#qty', '2'); await p.fill('#tp', '10'); await p.fill('#sl', '5'); await p.fill('#entry', '5000'); await p.locator('#entry').blur()
await check('entry-long')
const bars = {}
for (const t of ['calculator', 'contracts']) { await p.goto(url + '#/' + t); await p.waitForTimeout(300); bars[t] = await p.evaluate(() => JSON.stringify(document.querySelector('.tabs.bottom').getBoundingClientRect())) }
console.log(bars.calculator === bars.contracts ? 'OK   tab bar identical' : 'FAIL tab bar differs')
await b.close(); server.close(); process.exit(bad)
