// Checks the calculator fits one iPhone screen without scrolling (WebKit). Usage: npm run build && node scripts/screens-fit.mjs
import { webkit, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from './serve.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { server, url } = await serve(path.join(root, 'dist'))
const b = await webkit.launch()
const DEVS = [['se', 'iPhone SE (3rd gen)'], ['13mini', 'iPhone 13 Mini'], ['15pro', 'iPhone 15 Pro']]
let bad = 0
for (const [tag, name] of DEVS) {
  const ctx = await b.newContext({ ...devices[name], serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(url + '#/calculator'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('#tp')
  const shot = async (state) => {
    const m = await p.evaluate(() => {
      const main = document.querySelector('main'), bar = document.querySelector('.tabs.bottom')
      const last = document.querySelector('.calc .inputs').getBoundingClientRect().bottom
      return { docScroll: document.scrollingElement.scrollHeight - innerHeight, mainOver: main.scrollHeight - main.clientHeight,
        gapAboveBar: Math.round(bar.getBoundingClientRect().top - last), vh: innerHeight }
    })
    const ok = m.docScroll <= 0 && m.mainOver <= 0 && m.gapAboveBar >= 0
    if (!ok) bad++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${state}`, JSON.stringify(m))
    await p.screenshot({ path: path.join(root, 'screens', `fit-${tag}-${state}.png`) })
  }
  await shot('empty')
  await p.click('.picker-control'); await p.fill('.picker-input', 'ES'); await p.keyboard.press('Enter')
  await p.fill('#qty', '2'); await p.fill('#tp', '10'); await p.fill('#sl', '5')
  await p.fill('#entry', '5000'); await p.click('.seg.side button:has-text("Long")'); await p.locator('#entry').blur()
  await shot('entry-long')
  await p.click('.seg.side button:has-text("Short")')
  await shot('entry-short')
  // keyboard: focused field must be reachable (main scrolls internally if viewport shrinks)
  await p.setViewportSize({ width: devices[name].viewport.width, height: 340 })
  await p.focus('#entry'); await p.locator('#entry').scrollIntoViewIfNeeded()
  const vis = await p.evaluate(() => { const r = document.querySelector('#entry').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
  console.log(`${vis ? 'OK  ' : 'FAIL'} ${name} keyboard-sim entry visible`); if (!vis) bad++
  await ctx.close()
}
// other tabs still scroll
const ctx = await b.newContext({ ...devices['iPhone 15 Pro'], serviceWorkers: 'block' }); const p = await ctx.newPage()
await p.goto(url + '#/contracts'); await p.waitForSelector('.card')
const sc = await p.evaluate(() => { scrollTo(0, 400); return scrollY })
console.log(`${sc > 0 ? 'OK  ' : 'FAIL'} contracts tab scrolls (${sc})`); if (sc <= 0) bad++
await b.close(); server.close(); process.exit(bad ? 1 : 0)
