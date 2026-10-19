// iOS date-input layout check: WebKit (iPhone descriptor) + Chromium mobile at 390x844.
// Measures that date/time inputs stay inside their grid cells and line up with the selects above.
// Writes screens/journal-filters-iphone.png and screens/stats-filters-iphone.png (WebKit, SAMPLE data).
import { webkit, chromium, devices } from 'playwright'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const single = pathToFileURL(path.resolve(root, process.env.SINGLE_DIR || 'dist-single', 'index.html')).href
let failures = 0
const check = (name, ok, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`) }
const r = (b) => b && `[${b.x.toFixed(1)}..${(b.x + b.width).toFixed(1)} ×${b.height.toFixed(1)}]`

async function filterLayout(page, label) {
  const vw = page.viewportSize().width
  const sel = await page.locator('.filters select').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, width: b.width, height: b.height, y: b.y } }))
  const dates = await page.locator('.filters input[type=date]').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, width: b.width, height: b.height, y: b.y } }))
  const [from, to] = dates
  const [s1, s2] = sel
  console.log(`  ${label}: selects ${sel.map(r).join(' ')} | dates ${dates.map(r).join(' ')}`)
  const eq = (a, b) => Math.abs(a - b) < 0.6
  check(`${label}: From left edge = left select`, eq(from.x, s1.x))
  check(`${label}: From right edge = left select`, eq(from.x + from.width, s1.x + s1.width))
  check(`${label}: To left edge = right select`, eq(to.x, s2.x))
  check(`${label}: To right edge = right select`, eq(to.x + to.width, s2.x + s2.width))
  check(`${label}: no overlap`, from.x + from.width <= to.x + 0.5)
  check(`${label}: To inside viewport`, to.x + to.width <= vw - 10, `(vw ${vw})`)
  check(`${label}: date height = select height`, eq(from.height, s1.height) && eq(to.height, s1.height), `${from.height}/${s1.height}`)
  check(`${label}: select text not clipped`, await page.locator('.filters select').evaluateAll((els) => els.every((e) => e.scrollHeight <= e.clientHeight + 1)))
  check(`${label}: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
}

async function fieldInside(page, sel, label) {
  const b = await page.locator(sel).boundingBox()
  const parent = await page.locator(sel).evaluate((e) => { const g = e.closest('.tf-grid'); const p = g.getBoundingClientRect(); const l = e.closest('label').getBoundingClientRect(); return { gx: p.x + p.width, lx: l.x, lw: l.width } })
  check(`${label}: fits its cell`, b.x >= parent.lx - 0.5 && b.x + b.width <= parent.lx + parent.lw + 0.5 && b.x + b.width <= parent.gx + 0.5, `${r(b)} cell ${parent.lx.toFixed(1)}..${(parent.lx + parent.lw).toFixed(1)}`)
  check(`${label}: not collapsed`, b.height >= 40, `h=${b.height}`)
}

for (const [name, type, opts] of [
  ['webkit-iphone', webkit, { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
  ['chromium-mobile', chromium, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }],
]) {
  const browser = await type.launch(type === chromium ? { channel: process.env.PW_CHANNEL || 'chrome' } : {})
  const ctx = await browser.newContext({ ...opts, timezoneId: 'America/New_York' })
  const page = await ctx.newPage()
  // STRESS=1 mimics iOS Safari's intrinsic date-control width (Linux WebKit doesn't have it)
  if (process.env.STRESS) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'input[type=date]::-webkit-datetime-edit,input[type=datetime-local]::-webkit-datetime-edit{display:inline-block;min-width:260px}'; document.head.appendChild(st) }))
  page.on('pageerror', (e) => { failures++; console.log('PAGE ERROR', e.message) })
  await page.goto(single + '#/journal')
  await page.evaluate(() => localStorage.clear()); await page.reload()
  // empty journal, no accounts: filters still render
  await filterLayout(page, `${name} empty`)
  await page.goto(single + '#/journal/data'); await page.click('button:has-text("Load sample data")')
  await page.goto(single + '#/journal'); await page.waitForSelector('.filters')
  await filterLayout(page, `${name} trades`)
  await page.fill('.filters input[type=date] >> nth=0', '2026-10-01'); await page.fill('.filters input[type=date] >> nth=1', '2026-10-31')
  await filterLayout(page, `${name} trades (filled)`)
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) }); await page.waitForTimeout(150)
  if (name === 'webkit-iphone') await page.screenshot({ path: path.join(root, 'screens/journal-filters-iphone.png') })
  await page.click('.subtabs button:has-text("Stats")'); await page.waitForSelector('.kpis')
  await filterLayout(page, `${name} stats (filled)`)
  await page.click('.filters button:has-text("Clear")')
  await filterLayout(page, `${name} stats (empty)`)
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150)
  if (name === 'webkit-iphone') await page.screenshot({ path: path.join(root, 'screens/stats-filters-iphone.png') })
  // trade form date-time
  await page.click('.subtabs button:has-text("Trades")'); await page.click('text=+ New trade')
  await fieldInside(page, '.modal input[type=datetime-local]', `${name} trade form datetime`)
  if (name === 'webkit-iphone') await page.screenshot({ path: path.join(root, 'screens/extra-trade-form-iphone.png') })
  await page.keyboard.press('Escape'); await page.click('.modal-foot button:has-text("Cancel")').catch(() => {})
  // prop account start date
  await page.goto(single + '#/prop'); await page.click('button:has-text("+ New account")')
  await fieldInside(page, '.modal input[name=startDate]', `${name} account start date`)
  await page.fill('.modal input[name=startDate]', '')
  await fieldInside(page, '.modal input[name=startDate]', `${name} account start date (empty)`)
  if (name === 'webkit-iphone') { await page.locator('.modal input[name=startDate]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(root, 'screens/extra-account-form-iphone.png') }) }
  await page.evaluate(() => localStorage.clear())
  await browser.close()
}
console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll iOS date layout checks passed')
process.exit(failures ? 1 : 0)
