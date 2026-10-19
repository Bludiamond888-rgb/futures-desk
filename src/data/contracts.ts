/**
 * Futures contract specification table.
 *
 * Every entry with `verified: true` had its contract unit and minimum price
 * fluctuation (tick size + tick value) read from the official exchange
 * product page (cmegroup.com contractSpecs pages, ice.com/products, eurex.com
 * product "Specifications" tab, cboe.com) on Oct 18, 2026.
 * Entries with `verified: false` carry a comment explaining what could not be
 * confirmed.
 *
 * Price units: `tickSize` and `pointValue` are expressed in the units the
 * market is QUOTED in on trading screens. Grains / livestock / most softs are
 * quoted in US cents, so for those "1 point" = 1 cent (e.g. corn: 1¢ = $50).
 */
import type { ContractSpec } from './types'

const CME = 'https://www.cmegroup.com/markets/'
const cme = (path: string) => `${CME}${path}.contractSpecs.html`
const EUREX_IDX = 'https://www.eurex.com/ex-en/markets/idx/'
const EUREX_BONDS =
  'https://www.eurex.com/ex-en/markets/int/long-term-interest-rates/fix/government-bonds/Euro-Bund-Futures-137298'

type Row = Omit<ContractSpec, 'pointValue' | 'verified'> & { verified?: boolean }

/** pointValue is derived so it can never drift from tickValue / tickSize. */
const c = (r: Row): ContractSpec => ({
  ...r,
  verified: r.verified ?? true,
  pointValue: Math.round((r.tickValue / r.tickSize) * 1e6) / 1e6,
})

export const CONTRACTS: ContractSpec[] = [
  // ───────────── Equity indexes ─────────────
  c({ symbol: 'ES', name: 'E-mini S&P 500', exchange: 'CME', category: 'Equity Index', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '$50 × S&P 500 Index', quoteNotes: 'Index points. 1 pt = $50.', source: cme('equities/sp/e-mini-sandp500') }),
  c({ symbol: 'MES', name: 'Micro E-mini S&P 500', exchange: 'CME', category: 'Equity Index', tickSize: 0.25, tickValue: 1.25, currency: 'USD', contractSize: '$5 × S&P 500 Index', quoteNotes: 'Index points. 1 pt = $5.', source: cme('equities/sp/micro-e-mini-sandp-500') }),
  c({ symbol: 'NQ', name: 'E-mini Nasdaq-100', exchange: 'CME', category: 'Equity Index', tickSize: 0.25, tickValue: 5, currency: 'USD', contractSize: '$20 × Nasdaq-100 Index', quoteNotes: 'Index points. 1 pt = $20.', source: cme('equities/nasdaq/e-mini-nasdaq-100') }),
  c({ symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', exchange: 'CME', category: 'Equity Index', tickSize: 0.25, tickValue: 0.5, currency: 'USD', contractSize: '$2 × Nasdaq-100 Index', quoteNotes: 'Index points. 1 pt = $2.', source: cme('equities/nasdaq/micro-e-mini-nasdaq-100') }),
  c({ symbol: 'YM', name: 'E-mini Dow ($5)', exchange: 'CBOT', category: 'Equity Index', tickSize: 1, tickValue: 5, currency: 'USD', contractSize: '$5 × DJIA', quoteNotes: 'Index points; 1-point tick.', source: cme('equities/dow-jones/e-mini-dow') }),
  c({ symbol: 'MYM', name: 'Micro E-mini Dow', exchange: 'CBOT', category: 'Equity Index', tickSize: 1, tickValue: 0.5, currency: 'USD', contractSize: '$0.50 × DJIA', quoteNotes: 'Index points; 1-point tick.', source: cme('equities/dow-jones/micro-e-mini-dow') }),
  c({ symbol: 'RTY', name: 'E-mini Russell 2000', exchange: 'CME', category: 'Equity Index', tickSize: 0.1, tickValue: 5, currency: 'USD', contractSize: '$50 × Russell 2000 Index', quoteNotes: 'Index points. 1 pt = $50.', source: cme('equities/russell/e-mini-russell-2000') }),
  c({ symbol: 'M2K', name: 'Micro E-mini Russell 2000', exchange: 'CME', category: 'Equity Index', tickSize: 0.1, tickValue: 0.5, currency: 'USD', contractSize: '$5 × Russell 2000 Index', quoteNotes: 'Index points. 1 pt = $5.', source: cme('equities/russell/micro-e-mini-russell-2000') }),
  c({ symbol: 'EMD', name: 'E-mini S&P MidCap 400', exchange: 'CME', category: 'Equity Index', tickSize: 0.1, tickValue: 10, currency: 'USD', contractSize: '$100 × S&P MidCap 400 Index', quoteNotes: 'Index points. 1 pt = $100.', source: cme('equities/sp/e-mini-sandp-midcap-400') }),
  c({ symbol: 'NKD', name: 'Nikkei 225 (USD)', exchange: 'CME', category: 'Equity Index', tickSize: 5, tickValue: 25, currency: 'USD', contractSize: '$5 × Nikkei Stock Average', quoteNotes: 'Index points; 5-point tick.', source: cme('equities/international-indices/nikkei-225-dollar') }),
  c({ symbol: 'MFS', name: 'MSCI EAFE Index', exchange: 'ICE US', category: 'Equity Index', tickSize: 0.1, tickValue: 5, currency: 'USD', contractSize: '$50 × MSCI EAFE Index', quoteNotes: 'Index points. 1 pt = $50.', source: 'https://www.ice.com/products/31196848' }),
  c({ symbol: 'FESX', name: 'EURO STOXX 50', exchange: 'Eurex', category: 'Equity Index', tickSize: 1, tickValue: 10, currency: 'EUR', contractSize: '€10 × EURO STOXX 50 Index', quoteNotes: 'Index points; 1-point tick. Values in EUR.', source: `${EUREX_IDX}stx/euro-stoxx-50-derivatives/products/EURO-STOXX-50-Index-Futures-160088` }),
  c({ symbol: 'FSXE', name: 'Micro EURO STOXX 50', exchange: 'Eurex', category: 'Equity Index', tickSize: 0.5, tickValue: 0.5, currency: 'EUR', contractSize: '€1 × EURO STOXX 50 Index', quoteNotes: 'Index points. Values in EUR.', source: `${EUREX_IDX}stx/euro-stoxx-50-derivatives/products/Micro-EURO-STOXX-50-Index-Futures-2615510` }),
  c({ symbol: 'FDAX', name: 'DAX', exchange: 'Eurex', category: 'Equity Index', tickSize: 1, tickValue: 25, currency: 'EUR', contractSize: '€25 × DAX Index', quoteNotes: 'Index points; 1-point tick. Values in EUR.', source: `${EUREX_IDX}dax/DAX-Futures-139902` }),
  c({ symbol: 'FDXM', name: 'Mini-DAX', exchange: 'Eurex', category: 'Equity Index', tickSize: 1, tickValue: 5, currency: 'EUR', contractSize: '€5 × DAX Index', quoteNotes: 'Index points; 1-point tick. Values in EUR.', source: `${EUREX_IDX}dax/Mini-DAX-Futures-139894` }),
  c({ symbol: 'FDXS', name: 'Micro-DAX', exchange: 'Eurex', category: 'Equity Index', tickSize: 1, tickValue: 1, currency: 'EUR', contractSize: '€1 × DAX Index', quoteNotes: 'Index points; 1-point tick. Values in EUR.', source: `${EUREX_IDX}dax/Micro-DAX-Futures-2615492` }),

  // ───────────── Energy ─────────────
  c({ symbol: 'CL', name: 'WTI Crude Oil', exchange: 'NYMEX', category: 'Energy', tickSize: 0.01, tickValue: 10, currency: 'USD', contractSize: '1,000 barrels', quoteNotes: 'USD per barrel. $1.00 move = $1,000.', source: cme('energy/crude-oil/light-sweet-crude') }),
  c({ symbol: 'MCL', name: 'Micro WTI Crude Oil', exchange: 'NYMEX', category: 'Energy', tickSize: 0.01, tickValue: 1, currency: 'USD', contractSize: '100 barrels', quoteNotes: 'USD per barrel. $1.00 move = $100.', source: cme('energy/crude-oil/micro-wti-crude-oil') }),
  c({ symbol: 'QM', name: 'E-mini Crude Oil', exchange: 'NYMEX', category: 'Energy', tickSize: 0.025, tickValue: 12.5, currency: 'USD', contractSize: '500 barrels', quoteNotes: 'USD per barrel. $1.00 move = $500.', source: cme('energy/crude-oil/emini-crude-oil') }),
  c({ symbol: 'NG', name: 'Henry Hub Natural Gas', exchange: 'NYMEX', category: 'Energy', tickSize: 0.001, tickValue: 10, currency: 'USD', contractSize: '10,000 MMBtu', quoteNotes: 'USD per MMBtu. $0.10 move = $1,000.', source: cme('energy/natural-gas/natural-gas') }),
  c({ symbol: 'QG', name: 'E-mini Natural Gas', exchange: 'NYMEX', category: 'Energy', tickSize: 0.005, tickValue: 12.5, currency: 'USD', contractSize: '2,500 MMBtu', quoteNotes: 'USD per MMBtu.', source: cme('energy/natural-gas/emini-natural-gas') }),
  c({ symbol: 'MNG', name: 'Micro Henry Hub Natural Gas', exchange: 'NYMEX', category: 'Energy', tickSize: 0.001, tickValue: 1, currency: 'USD', contractSize: '1,000 MMBtu', quoteNotes: 'USD per MMBtu.', source: cme('energy/natural-gas/micro-henry-hub-natural-gas') }),
  c({ symbol: 'RB', name: 'RBOB Gasoline', exchange: 'NYMEX', category: 'Energy', tickSize: 0.0001, tickValue: 4.2, currency: 'USD', contractSize: '42,000 gallons', quoteNotes: 'USD per gallon. $0.01 move = $420.', source: cme('energy/refined-products/rbob-gasoline') }),
  c({ symbol: 'HO', name: 'NY Harbor ULSD (Heating Oil)', exchange: 'NYMEX', category: 'Energy', tickSize: 0.0001, tickValue: 4.2, currency: 'USD', contractSize: '42,000 gallons', quoteNotes: 'USD per gallon. $0.01 move = $420.', source: cme('energy/refined-products/heating-oil') }),
  c({ symbol: 'B', name: 'Brent Crude', exchange: 'ICE Europe', category: 'Energy', tickSize: 0.01, tickValue: 10, currency: 'USD', contractSize: '1,000 barrels', quoteNotes: 'USD per barrel. $1.00 move = $1,000.', source: 'https://www.ice.com/products/219/Brent-Crude-Futures' }),
  c({ symbol: 'G', name: 'Low Sulphur Gasoil', exchange: 'ICE Europe', category: 'Energy', tickSize: 0.25, tickValue: 25, currency: 'USD', contractSize: '100 metric tonnes', quoteNotes: 'USD per metric tonne. $1.00 move = $100.', source: 'https://www.ice.com/products/34361119/Low-Sulphur-Gasoil-Futures' }),

  // ───────────── Metals ─────────────
  c({ symbol: 'GC', name: 'Gold', exchange: 'COMEX', category: 'Metals', tickSize: 0.1, tickValue: 10, currency: 'USD', contractSize: '100 troy oz', quoteNotes: 'USD per troy oz. $1.00 move = $100.', source: cme('metals/precious/gold') }),
  c({ symbol: 'MGC', name: 'Micro Gold', exchange: 'COMEX', category: 'Metals', tickSize: 0.1, tickValue: 1, currency: 'USD', contractSize: '10 troy oz', quoteNotes: 'USD per troy oz. $1.00 move = $10.', source: cme('metals/precious/e-micro-gold') }),
  c({ symbol: 'SI', name: 'Silver', exchange: 'COMEX', category: 'Metals', tickSize: 0.005, tickValue: 25, currency: 'USD', contractSize: '5,000 troy oz', quoteNotes: 'USD per troy oz. $0.01 move = $50.', source: cme('metals/precious/silver') }),
  c({ symbol: 'SIL', name: 'Micro Silver (1,000 oz)', exchange: 'COMEX', category: 'Metals', tickSize: 0.005, tickValue: 5, currency: 'USD', contractSize: '1,000 troy oz', quoteNotes: 'USD per troy oz. $0.01 move = $10.', source: cme('metals/precious/1000-oz-silver') }),
  c({ symbol: 'HG', name: 'Copper', exchange: 'COMEX', category: 'Metals', tickSize: 0.0005, tickValue: 12.5, currency: 'USD', contractSize: '25,000 lb', quoteNotes: 'USD per lb. $0.01 move = $250.', source: cme('metals/base/copper') }),
  c({ symbol: 'MHG', name: 'Micro Copper', exchange: 'COMEX', category: 'Metals', tickSize: 0.0005, tickValue: 1.25, currency: 'USD', contractSize: '2,500 lb', quoteNotes: 'USD per lb. $0.01 move = $25.', source: cme('metals/base/micro-copper') }),
  c({ symbol: 'PL', name: 'Platinum', exchange: 'NYMEX', category: 'Metals', tickSize: 0.1, tickValue: 5, currency: 'USD', contractSize: '50 troy oz', quoteNotes: 'USD per troy oz. $1.00 move = $50.', source: cme('metals/precious/platinum') }),
  c({ symbol: 'PA', name: 'Palladium', exchange: 'NYMEX', category: 'Metals', tickSize: 0.5, tickValue: 50, currency: 'USD', contractSize: '100 troy oz', quoteNotes: 'USD per troy oz. $1.00 move = $100.', source: cme('metals/precious/palladium') }),

  // ───────────── Interest rates ─────────────
  c({ symbol: 'ZT', name: '2-Year T-Note', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 256, tickValue: 7.8125, currency: 'USD', contractSize: '$200,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $2,000; 1/32 = $62.50.', priceFormat: '32nds', tickLabel: '1/8 of 1/32', source: cme('interest-rates/us-treasury/2-year-us-treasury-note') }),
  c({ symbol: 'ZF', name: '5-Year T-Note', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 128, tickValue: 7.8125, currency: 'USD', contractSize: '$100,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $1,000; 1/32 = $31.25.', priceFormat: '32nds', tickLabel: '1/4 of 1/32', source: cme('interest-rates/us-treasury/5-year-us-treasury-note') }),
  c({ symbol: 'ZN', name: '10-Year T-Note', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 64, tickValue: 15.625, currency: 'USD', contractSize: '$100,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $1,000; 1/32 = $31.25.', priceFormat: '32nds', tickLabel: '1/2 of 1/32', source: cme('interest-rates/us-treasury/10-year-us-treasury-note') }),
  c({ symbol: 'TN', name: 'Ultra 10-Year T-Note', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 64, tickValue: 15.625, currency: 'USD', contractSize: '$100,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $1,000; 1/32 = $31.25.', priceFormat: '32nds', tickLabel: '1/2 of 1/32', source: cme('interest-rates/us-treasury/ultra-10-year-us-treasury-note') }),
  c({ symbol: 'ZB', name: 'U.S. Treasury Bond', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 32, tickValue: 31.25, currency: 'USD', contractSize: '$100,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $1,000; 1/32 = $31.25.', priceFormat: '32nds', tickLabel: '1/32', source: cme('interest-rates/us-treasury/30-year-us-treasury-bond') }),
  c({ symbol: 'UB', name: 'Ultra U.S. Treasury Bond', exchange: 'CBOT', category: 'Interest Rates', tickSize: 1 / 32, tickValue: 31.25, currency: 'USD', contractSize: '$100,000 face value', quoteNotes: 'Points & 32nds of 100% par. 1 point (handle) = $1,000; 1/32 = $31.25.', priceFormat: '32nds', tickLabel: '1/32', source: cme('interest-rates/us-treasury/ultra-t-bond') }),
  c({ symbol: 'SR3', name: '3-Month SOFR', exchange: 'CME', category: 'Interest Rates', tickSize: 0.005, tickValue: 12.5, currency: 'USD', contractSize: '$2,500 × IMM Index', quoteNotes: 'Price = 100 − rate. 1 bp (0.01) = $25. Contracts within 4 months of expiry tick 0.0025 = $6.25 (same point value).', source: cme('interest-rates/stirs/three-month-sofr') }),
  c({ symbol: 'SR1', name: '1-Month SOFR', exchange: 'CME', category: 'Interest Rates', tickSize: 0.005, tickValue: 20.835, currency: 'USD', contractSize: '$4,167 × IMM Index', quoteNotes: 'Price = 100 − rate. 1 bp = $41.67. Nearby month ticks 0.0025 = $10.4175.', source: cme('interest-rates/stirs/one-month-sofr') }),
  c({ symbol: 'ZQ', name: '30-Day Fed Funds', exchange: 'CBOT', category: 'Interest Rates', tickSize: 0.005, tickValue: 20.835, currency: 'USD', contractSize: '$4,167 × IMM Index', quoteNotes: 'Price = 100 − avg EFFR. 1 bp = $41.67. Spot month ticks 0.0025 = $10.4175.', source: cme('interest-rates/stirs/30-day-federal-fund') }),
  c({ symbol: 'FGBS', name: 'Euro-Schatz (2Y)', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.005, tickValue: 5, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal, not 32nds). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FGBM', name: 'Euro-Bobl (5Y)', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.01, tickValue: 10, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FGBL', name: 'Euro-Bund (10Y)', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.01, tickValue: 10, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FGBX', name: 'Euro-Buxl (30Y)', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.02, tickValue: 20, currency: 'EUR', contractSize: '€100,000 nominal, 4% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FBTS', name: 'Short-Term Euro-BTP', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.005, tickValue: 5, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FBTP', name: 'Long-Term Euro-BTP', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.01, tickValue: 10, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),
  c({ symbol: 'FOAT', name: 'Euro-OAT', exchange: 'Eurex', category: 'Interest Rates', tickSize: 0.01, tickValue: 10, currency: 'EUR', contractSize: '€100,000 nominal, 6% coupon', quoteNotes: 'Percent of par (decimal). 1.00 = €1,000.', source: EUREX_BONDS }),

  // ───────────── FX ─────────────
  c({ symbol: '6E', name: 'Euro FX', exchange: 'CME', category: 'FX', tickSize: 0.00005, tickValue: 6.25, currency: 'USD', contractSize: '€125,000', quoteNotes: 'USD per EUR. 1 pip (0.0001) = $12.50; 1.0000 move = $125,000.', source: cme('fx/g10/euro-fx') }),
  c({ symbol: 'M6E', name: 'Micro EUR/USD', exchange: 'CME', category: 'FX', tickSize: 0.0001, tickValue: 1.25, currency: 'USD', contractSize: '€12,500', quoteNotes: 'USD per EUR. 1 pip (0.0001) = $1.25.', source: cme('fx/g10/e-micro-euro') }),
  c({ symbol: '6J', name: 'Japanese Yen', exchange: 'CME', category: 'FX', tickSize: 0.0000005, tickValue: 6.25, currency: 'USD', contractSize: '¥12,500,000', quoteNotes: 'USD per JPY (e.g. 0.006650). 0.000001 = $12.50.', source: cme('fx/g10/japanese-yen') }),
  c({ symbol: '6B', name: 'British Pound', exchange: 'CME', category: 'FX', tickSize: 0.0001, tickValue: 6.25, currency: 'USD', contractSize: '£62,500', quoteNotes: 'USD per GBP. 1 pip (0.0001) = $6.25.', source: cme('fx/g10/british-pound') }),
  c({ symbol: 'M6B', name: 'Micro GBP/USD', exchange: 'CME', category: 'FX', tickSize: 0.0001, tickValue: 0.625, currency: 'USD', contractSize: '£6,250', quoteNotes: 'USD per GBP. 1 pip = $0.625.', source: cme('fx/g10/e-micro-british-pound') }),
  c({ symbol: '6A', name: 'Australian Dollar', exchange: 'CME', category: 'FX', tickSize: 0.00005, tickValue: 5, currency: 'USD', contractSize: 'A$100,000', quoteNotes: 'USD per AUD. 1 pip (0.0001) = $10.', source: cme('fx/g10/australian-dollar') }),
  c({ symbol: 'M6A', name: 'Micro AUD/USD', exchange: 'CME', category: 'FX', tickSize: 0.0001, tickValue: 1, currency: 'USD', contractSize: 'A$10,000', quoteNotes: 'USD per AUD. 1 pip = $1.', source: cme('fx/g10/e-micro-australian-dollar') }),
  c({ symbol: '6C', name: 'Canadian Dollar', exchange: 'CME', category: 'FX', tickSize: 0.00005, tickValue: 5, currency: 'USD', contractSize: 'C$100,000', quoteNotes: 'USD per CAD. 1 pip (0.0001) = $10.', source: cme('fx/g10/canadian-dollar') }),
  c({ symbol: '6S', name: 'Swiss Franc', exchange: 'CME', category: 'FX', tickSize: 0.00005, tickValue: 6.25, currency: 'USD', contractSize: 'CHF 125,000', quoteNotes: 'USD per CHF. 1 pip (0.0001) = $12.50.', source: cme('fx/g10/swiss-franc') }),
  c({ symbol: '6N', name: 'New Zealand Dollar', exchange: 'CME', category: 'FX', tickSize: 0.00005, tickValue: 5, currency: 'USD', contractSize: 'NZ$100,000', quoteNotes: 'USD per NZD. 1 pip (0.0001) = $10.', source: cme('fx/g10/new-zealand-dollar') }),
  c({ symbol: '6M', name: 'Mexican Peso', exchange: 'CME', category: 'FX', tickSize: 0.00001, tickValue: 5, currency: 'USD', contractSize: 'MXN 500,000', quoteNotes: 'USD per MXN (e.g. 0.05400).', source: cme('fx/emerging-market/mexican-peso') }),
  c({ symbol: 'DX', name: 'U.S. Dollar Index', exchange: 'ICE US', category: 'FX', tickSize: 0.005, tickValue: 5, currency: 'USD', contractSize: '$1,000 × USDX', quoteNotes: 'Index points. 1.00 = $1,000.', source: 'https://www.ice.com/products/194/US-Dollar-Index-Futures' }),

  // ───────────── Grains & oilseeds (quoted in cents) ─────────────
  c({ symbol: 'ZC', name: 'Corn', exchange: 'CBOT', category: 'Grains', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '5,000 bushels', quoteNotes: 'US cents per bushel. 1 point = 1¢ = $50.', source: cme('agriculture/grains/corn') }),
  c({ symbol: 'ZS', name: 'Soybeans', exchange: 'CBOT', category: 'Grains', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '5,000 bushels', quoteNotes: 'US cents per bushel. 1 point = 1¢ = $50.', source: cme('agriculture/oilseeds/soybean') }),
  c({ symbol: 'ZW', name: 'Chicago SRW Wheat', exchange: 'CBOT', category: 'Grains', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '5,000 bushels', quoteNotes: 'US cents per bushel. 1 point = 1¢ = $50.', source: cme('agriculture/grains/wheat') }),
  c({ symbol: 'KE', name: 'KC HRW Wheat', exchange: 'CBOT', category: 'Grains', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '5,000 bushels', quoteNotes: 'US cents per bushel. 1 point = 1¢ = $50.', source: cme('agriculture/grains/kc-wheat') }),
  c({ symbol: 'ZO', name: 'Oats', exchange: 'CBOT', category: 'Grains', tickSize: 0.25, tickValue: 12.5, currency: 'USD', contractSize: '5,000 bushels', quoteNotes: 'US cents per bushel. 1 point = 1¢ = $50.', source: cme('agriculture/grains/oats') }),
  c({ symbol: 'ZM', name: 'Soybean Meal', exchange: 'CBOT', category: 'Grains', tickSize: 0.1, tickValue: 10, currency: 'USD', contractSize: '100 short tons', quoteNotes: 'USD per short ton. $1.00 = $100.', source: cme('agriculture/oilseeds/soybean-meal') }),
  c({ symbol: 'ZL', name: 'Soybean Oil', exchange: 'CBOT', category: 'Grains', tickSize: 0.01, tickValue: 6, currency: 'USD', contractSize: '60,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $600.', source: cme('agriculture/oilseeds/soybean-oil') }),
  c({ symbol: 'ZR', name: 'Rough Rice', exchange: 'CBOT', category: 'Grains', tickSize: 0.005, tickValue: 10, currency: 'USD', contractSize: '2,000 cwt', quoteNotes: 'USD per cwt. $1.00 = $2,000.', source: cme('agriculture/grains/rough-rice') }),

  // ───────────── Livestock (quoted in cents/lb) ─────────────
  c({ symbol: 'LE', name: 'Live Cattle', exchange: 'CME', category: 'Livestock', tickSize: 0.025, tickValue: 10, currency: 'USD', contractSize: '40,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $400.', source: cme('agriculture/livestock/live-cattle') }),
  c({ symbol: 'GF', name: 'Feeder Cattle', exchange: 'CME', category: 'Livestock', tickSize: 0.025, tickValue: 12.5, currency: 'USD', contractSize: '50,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $500.', source: cme('agriculture/livestock/feeder-cattle') }),
  c({ symbol: 'HE', name: 'Lean Hogs', exchange: 'CME', category: 'Livestock', tickSize: 0.025, tickValue: 10, currency: 'USD', contractSize: '40,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $400.', source: cme('agriculture/livestock/lean-hogs') }),

  // ───────────── Softs (ICE US) ─────────────
  c({ symbol: 'KC', name: 'Coffee "C"', exchange: 'ICE US', category: 'Softs', tickSize: 0.05, tickValue: 18.75, currency: 'USD', contractSize: '37,500 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $375.', source: 'https://www.ice.com/products/15/Coffee-C-Futures' }),
  c({ symbol: 'SB', name: 'Sugar No. 11', exchange: 'ICE US', category: 'Softs', tickSize: 0.01, tickValue: 11.2, currency: 'USD', contractSize: '112,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $1,120.', source: 'https://www.ice.com/products/23/Sugar-No-11-Futures' }),
  c({ symbol: 'CC', name: 'Cocoa', exchange: 'ICE US', category: 'Softs', tickSize: 1, tickValue: 10, currency: 'USD', contractSize: '10 metric tons', quoteNotes: 'USD per metric ton. $1 = $10.', source: 'https://www.ice.com/products/7/Cocoa-Futures' }),
  c({ symbol: 'CT', name: 'Cotton No. 2', exchange: 'ICE US', category: 'Softs', tickSize: 0.01, tickValue: 5, currency: 'USD', contractSize: '50,000 lb', quoteNotes: 'US cents per lb. 1 point = 1¢ = $500.', source: 'https://www.ice.com/products/254/Cotton-No-2-Futures' }),
  c({ symbol: 'OJ', name: 'FCOJ-A (Orange Juice)', exchange: 'ICE US', category: 'Softs', tickSize: 0.05, tickValue: 7.5, currency: 'USD', contractSize: '15,000 lb OJ solids', quoteNotes: 'US cents per lb. 1 point = 1¢ = $150.', source: 'https://www.ice.com/products/30/FCOJ-A-Futures' }),

  // ───────────── Crypto ─────────────
  c({ symbol: 'BTC', name: 'Bitcoin', exchange: 'CME', category: 'Crypto', tickSize: 5, tickValue: 25, currency: 'USD', contractSize: '5 bitcoin', quoteNotes: 'USD per bitcoin. $1 move = $5.', source: cme('cryptocurrencies/bitcoin/bitcoin') }),
  c({ symbol: 'MBT', name: 'Micro Bitcoin', exchange: 'CME', category: 'Crypto', tickSize: 5, tickValue: 0.5, currency: 'USD', contractSize: '0.1 bitcoin', quoteNotes: 'USD per bitcoin. $1 move = $0.10.', source: cme('cryptocurrencies/bitcoin/micro-bitcoin') }),
  c({ symbol: 'ETH', name: 'Ether', exchange: 'CME', category: 'Crypto', tickSize: 0.5, tickValue: 25, currency: 'USD', contractSize: '50 ether', quoteNotes: 'USD per ether. $1 move = $50.', source: cme('cryptocurrencies/ether/ether') }),
  c({ symbol: 'MET', name: 'Micro Ether', exchange: 'CME', category: 'Crypto', tickSize: 0.5, tickValue: 0.05, currency: 'USD', contractSize: '0.1 ether', quoteNotes: 'USD per ether. $1 move = $0.10.', source: cme('cryptocurrencies/ether/micro-ether') }),

  // ───────────── Volatility ─────────────
  // UNVERIFIED (partial): the $1,000 multiplier was confirmed on cboe.com's VX
  // spec page, but the collapsed "Minimum Price Intervals" section could not be
  // read. Tick 0.05 = $50 is the long-standing CFE spec; double-check before relying on it.
  c({ symbol: 'VX', name: 'Cboe VIX Futures', exchange: 'Cboe (CFE)', category: 'Volatility', tickSize: 0.05, tickValue: 50, currency: 'USD', contractSize: '$1,000 × VIX', quoteNotes: 'VIX index points. 1.00 = $1,000.', verified: false, source: 'https://www.cboe.com/tradable_products/vix/vix_futures/specifications/' }),
]

export const CONTRACT_BY_SYMBOL: Record<string, ContractSpec> = Object.fromEntries(
  CONTRACTS.map((x) => [x.symbol, x]),
)
