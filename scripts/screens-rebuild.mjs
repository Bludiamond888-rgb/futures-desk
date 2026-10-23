// 16 Pro Max home-screen simulation (440x956 @3x, safe areas 62/34) of every tab. Usage: npm run build && node scripts/screens-rebuild.mjs
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { server, url } = await serve(path.join(root, 'dist'))
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 15 Pro Max'], viewport: { width: 440, height: Number(process.env.VH || 894) }, screen: { width: 440, height: 956 }, deviceScaleFactor: 3, serviceWorkers: 'block', timezoneId: 'America/New_York' })
const p = await ctx.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
await p.addInitScript((sa) => { document.addEventListener('DOMContentLoaded', () => {
  const fix = () => { for (const sh of document.styleSheets) { try { for (const r of [...sh.cssRules]) walk(r) } catch {} } }
  function walk(r) { if (r.cssRules) for (const c of r.cssRules) walk(c); if (r.style && r.style.cssText.includes('safe-area-inset')) r.style.cssText = r.style.cssText.replace(/env\(safe-area-inset-top\)/g, sa.top + 'px').replace(/env\(safe-area-inset-bottom\)/g, sa.bottom + 'px').replace(/env\(safe-area-inset-(left|right)\)/g, '0px') }
  fix(); new MutationObserver(fix).observe(document.head, { childList: true })
}) }, { top: Number(process.env.SAFE_TOP || 0), bottom: 34 })
const shot = async (n, full = false) => { await p.waitForTimeout(250); await p.screenshot({ path: path.join(root, 'screens', `${process.env.PREFIX || "header"}-${n}.png`), fullPage: full }) }
const bars = []
const bar = async (t) => bars.push([t, await p.evaluate(() => { const r = document.querySelector('.tabs.bottom').getBoundingClientRect(); return `${r.top}-${r.bottom}` })])
const go = async (h, sel) => { await p.goto(url + h); await p.waitForSelector(sel); await p.evaluate(() => scrollTo(0, 0)) }

await go('#/calculator', '#tp'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#tp')
await shot('01-calculator-empty'); await bar('calculator')
await p.click('.picker-control'); await p.fill('.picker-input', 'ES'); await p.keyboard.press('Enter')
await p.fill('#qty', '2'); await p.fill('#tp', '10'); await p.fill('#sl', '5'); await p.fill('#entry', '5000'); await p.locator('#entry').blur()
await shot('02-calculator-long')
await p.click('.seg.side button:has-text("Short")'); await shot('03-calculator-short')
await go('#/contracts', '.card'); await shot('04-contracts'); await bar('contracts')
const hdr = async () => p.evaluate(() => { const r = document.querySelector('.topbar').getBoundingClientRect(); return `${r.top}/${r.bottom}` })
const h0 = await hdr(); await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(200)
const h1 = await hdr(); const sy = await p.evaluate(() => scrollY)
await shot('04b-contracts-scrolled')
console.log('header at top', h0, 'after scrolling', sy, 'px:', h1, h0 === h1 ? 'STAYS PUT' : 'MOVED')
if (h0 !== h1 || sy < 1000) process.exitCode = 1
await go('#/journal', '.j-head'); await shot('05-journal-empty'); await bar('journal')
await go('#/prop', '.screen'); await shot('06-prop-empty'); await bar('prop')
await go('#/prop/prices', '.pp-list'); await shot('07-prop-prices')
await go('#/journal/data', 'button:has-text("Load sample data")'); await p.click('button:has-text("Load sample data")'); await p.waitForTimeout(300)
await p.evaluate(() => scrollTo(0, 0)); await shot('08-journal-data')
await go('#/journal', '.tcard'); await shot('09-journal-trades')
await p.click('text=+ New trade'); await p.waitForSelector('.modal'); await shot('10-journal-new-trade'); await p.keyboard.press('Escape')
await go('#/journal/stats', '.equity'); await shot('11-journal-stats')
await go('#/prop', '.pcard'); await shot('12-prop-accounts')
await go('#/calculator', '#tp'); await p.waitForSelector('[data-testid=calc-prop]'); await p.evaluate(() => scrollTo(0, 1e5)); await shot('13-calculator-prop-panel')
const header = await p.evaluate(() => { const h = document.querySelector('.topbar'); const cs = getComputedStyle(h); const b = getComputedStyle(document.querySelector('.brand')); return { position: cs.position, bg: cs.backgroundColor, backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none', opacity: cs.opacity, transform: cs.transform, filter: cs.filter, brandOpacity: b.opacity, brandFilter: b.filter, height: h.getBoundingClientRect().height, logoTag: document.querySelector('.brand .logo').tagName, overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY } })
const uniq = new Set(bars.map((x) => x[1]))
console.log('tab bar per tab', JSON.stringify(bars), uniq.size === 1 ? 'IDENTICAL' : 'DIFFERENT')
console.log('header', JSON.stringify(header))
console.log('page errors', errors.length ? errors : 'none')
await b.close(); server.close(); process.exit(uniq.size === 1 && !errors.length && !process.exitCode ? 0 : 1)
