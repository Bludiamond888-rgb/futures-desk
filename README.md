# Futures Calc

React + TypeScript + Vite. Dark trader-style UI. All data stays on the device (localStorage).

Sections: **Calculator**, **Contracts** (83 verified specs + custom), **Journal** (Trades · Stats · Data), **Prop** (prop-firm rules tracker).

## Builds
`npm run build` produces both outputs:

| Output | What it is |
|---|---|
| `dist/` | Deployable static PWA (manifest, icons, `sw.js` offline cache, relative paths). Upload the folder to GitHub Pages / Netlify / any static host. |
| `dist-single/index.html` | One self-contained offline HTML file (no service worker, no manifest; icons inlined). Open from anywhere, including `file://`. |

Separately: `npm run build:pwa`, `npm run build:single`.

`OUT_DIR=.build-dev npx vite build [--mode single]` writes to `.build-dev/dist*` instead (gitignored), so you can test without touching a `dist/` that's being deployed. The smoke scripts accept `DIST_DIR=` / `SINGLE_DIR=`.

### Deploying (not done automatically)
- **Netlify:** drag-and-drop `dist/` or set publish dir = `dist`, build = `npm run build`.
- **GitHub Pages:** publish the contents of `dist/` (includes `.nojekyll`). Relative base `./` works from a sub-path such as `/<repo>/`.
- iPhone install: open the hosted URL in Safari → Share → Add to Home Screen. A service worker needs HTTPS (both hosts provide it).

## Tests
- `npm test`: vitest unit tests (calc engine, spec sanity, P&L, stats, CSV round trip, JSON backup)
- `npm run test:e2e`: Playwright smoke test (adds 3 trades, reloads, prop account create/bulk-assign/dashboard/calculator warning/backup, checks stats/filters/duplicate/delete, CSV + JSON round trips, screenshot attach, storage warning, SW offline, single-file build)
- `npm run smoke`: both browser smoke tests
- `npm run test:ios`: date/time input layout check in Playwright WebKit (iPhone descriptor) + Chromium mobile at 390×844. It checks the fields line up with the selects and don't overflow, and writes `screens/journal-filters-iphone.png` and `screens/stats-filters-iphone.png`. `STRESS=1` forces an iOS-like wide built-in date width. Needs `npx playwright install webkit` + `sudo npx playwright install-deps webkit`.
- `npm run screens`: regenerate screenshots into `screens/` (loads SAMPLE data, then clears it)
- Icons: `python3 scripts/make-icons.py` (Pillow)

Browser scripts use system Chrome (`PW_CHANNEL=chrome`); set `PW_CHANNEL=` to another channel if needed.

## Data
localStorage keys: `fta.trades.v1`, `fta.strategies.v1`, `fta.customContracts.v1`, `fta.journal.filters.v1`,
`fta.calculator.v1`, `fta.calculator.symbol.v1`, `fta.propAccounts.v1`, `fta.calculator.prop.v1`.

- Each trade stores a snapshot of tickSize / tickValue / currency, so P&L survives later spec edits or deleted custom contracts.
- Fees = total round-trip commissions and fees for the trade, in the contract currency. Net = gross − fees.
- Stats are computed per currency (USD, EUR…) and are never converted or combined.
- CSV: RFC 4180, UTF-8 with BOM. It round-trips every field except screenshots. Computed columns (points, ticks, grossPnl, netPnl) are export-only.
- JSON backup (v2): trades (with screenshots), custom contracts, strategies and prop accounts. v1 files still restore. Restoring replaces current data.
- Sample data: Journal → Data → "Load sample data" (off by default, every trade is marked Sample).

## Prop tracker
- Presets live in `src/data/propFirms.ts`: Apex, Topstep, Take Profit Trader, MyFundedFutures, Tradeify, Bulenox, Elite Trader Funding, TradeDay, Lucid. Each preset stores `sourceUrl`, `lastVerified` and `verification` (`verified` / `partial` + an `unverified` list). Rules change often: re-check against the firm's page and bump `LAST_VERIFIED`.
- Every rule is copied into the account when it's created and can be edited per account. "Custom rules" starts blank.
- Trades link via `accountId` (trade form picker or Journal bulk-assign). Only USD trades count; balances are net of fees.
- Drawdown: static = start − DD. Intraday trailing uses the balance after each closed trade (no tick data, so open-profit peaks are missed). EOD trailing uses each session's closing balance and only applies after the session closes. Trailing stops at start + `trailLockOffset` (null = never stops trailing).
- Sessions roll at 6 PM local time (assumes ET trade times); weekend trades count toward Monday.
- Status: breached (balance ≤ threshold or DLL used), warning (within 25% of the DD or DLL room, or target reached while consistency/min days are unmet), target reached, on track.
