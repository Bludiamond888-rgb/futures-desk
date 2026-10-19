// Usage: npm run build && node scripts/screenshots.mjs
// Uses the single-file build over file://. Journal/stats shots use clearly-labelled SAMPLE data,
// which is loaded via the in-app "Load sample data" button and removed again at the end.
import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = pathToFileURL(path.join(root, 'dist-single/index.html')).href
const out = (n) => path.join(root, 'screens', n)
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' })

async function calcExample(page) {
  await page.goto(url + '#/calculator')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.click('.picker-control')
  await page.fill('.picker-input', 'MNQ')
  await page.keyboard.press('Enter')
  await page.fill('#qty', '5')
  await page.fill('#move', '10')
  const v = await page.textContent('[data-testid=value]')
  if (v.trim() !== '$100.00') throw new Error('Expected $100.00, got ' + v)
}
async function loadSample(page) {
  await page.goto(url + '#/journal/data')
  await page.click('button:has-text("Load sample data")')
}

const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

// Phase 1
await calcExample(desk); await desk.screenshot({ path: out('calculator-desktop.png') })
await calcExample(mob); await mob.screenshot({ path: out('calculator-mobile.png') })
await desk.goto(url + '#/contracts'); await desk.waitForSelector('.card'); await desk.screenshot({ path: out('contracts-desktop.png') })

// Phase 2 (sample data)
await loadSample(desk)
await desk.goto(url + '#/journal'); await desk.waitForSelector('table.trades')
await desk.screenshot({ path: out('journal-desktop.png') })
await desk.goto(url + '#/journal/stats'); await desk.waitForSelector('.equity')
await desk.setViewportSize({ width: 1280, height: 1150 })
await desk.screenshot({ path: out('stats-desktop.png') })
await desk.setViewportSize({ width: 1280, height: 800 })
await desk.goto(url + '#/journal'); await desk.locator('table.trades tbody tr').first().locator('button[aria-label=Edit]').click()
await desk.waitForSelector('.modal'); await desk.screenshot({ path: out('extra-trade-form-desktop.png') }); await desk.keyboard.press('Escape')

await loadSample(mob)
await mob.goto(url + '#/journal'); await mob.waitForSelector('.tcard'); await mob.evaluate(() => window.scrollTo(0, 0))
await mob.screenshot({ path: out('journal-mobile.png') })
await mob.goto(url + '#/journal/stats'); await mob.waitForSelector('.equity'); await mob.evaluate(() => window.scrollTo(0, 0))
await mob.screenshot({ path: out('stats-mobile.png') })
await mob.screenshot({ path: out('extra-stats-mobile-full.png'), fullPage: true })
await mob.goto(url + '#/journal'); await mob.click('text=+ New trade'); await mob.waitForSelector('.modal')
await mob.screenshot({ path: out('extra-trade-form-mobile.png') })
await mob.keyboard.press('Escape'); await mob.goto(url + '#/journal/data'); await mob.evaluate(() => window.scrollTo(0, 0)); await mob.screenshot({ path: out('extra-data-mobile.png'), fullPage: true })

// Remove sample data again so nothing lingers.
for (const p of [desk, mob]) await p.evaluate(() => localStorage.clear())
await browser.close()
console.log('screenshots written')
