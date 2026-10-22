export type Verdict = { c: 'BUY' | 'WAIT' | 'WATCH' | 'AVOID' | string; l: string; o: string; k: string };

/** A risk flag arrives as plain text for some companies and as {s: severity, t: text, k: the number behind it} for others. */
export type RiskFlag = string | { s?: string; t: string; k?: string };

export interface Row {
  sym: string;
  name: string;
  ind: string;
  sector: string;
  isin?: string;
  tier?: string;
  price: number | null;
  fy?: string;
  roce?: number | null;
  roe?: number | null;
  ebit_margin?: number | null;
  net_margin?: number | null;
  de?: number | null;
  icover?: number | null;
  rev_cagr?: number | null;
  eps_cagr?: number | null;
  rev_growth?: number | null;
  pe?: number | null;
  pb?: number | null;
  div_yield?: number | null;
  insiders?: number | null;
  instis?: number | null;
  piotroski?: number | null;
  piotroski_of?: number | null;
  rsi?: number | null;
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  turnover_cr?: number | null;
  mcap_cr?: number | null;
  high52?: number | null;
  low52?: number | null;
  from_high?: number | null;
  r1d?: number | null;
  r1w?: number | null;
  r1m?: number | null;
  r3m?: number | null;
  r6m?: number | null;
  r1y?: number | null;
  r3y_cagr?: number | null;
  rs3m?: number | null;
  q?: number | null;
  g?: number | null;
  v?: number | null;
  tech?: number | null;
  comp?: number | null;
  cfo_pat?: number | null;
  fcf_margin?: number | null;
  pe_pctile?: number | null;
  risk?: { level: string; score: number; flags: RiskFlag[] };
  vd?: Verdict;
  ahimsa?: boolean;
  vet?: { s: string; p: number; n: number; f: string[]; w: string };
  /** fiscal years of statements on file, and whether there are any; the screen's own count */
  fy_count?: number | null; has_stmts?: boolean | null;
  /** coverage of each score: the share of its inputs that were measured (0-1) */
  q_conf?: number | null; g_conf?: number | null; v_conf?: number | null; tech_conf?: number | null;
  mf?: { rank?: number; of?: number; roc_rank?: number; ey_rank?: number; score?: number; roc?: number; ey?: number; ev_cr?: number; ebit_cr?: number; why?: string };
  next_earnings?: string | null;
  last_date?: string;
}

export interface Breadth {
  above20: number;
  above50: number;
  above200: number;
  advancing: number;
  declining: number;
  counted: number;
  median_1m: number;
  at_52w_high: number;
  label: string;
  nifty_1m: number;
  nifty_1y: number;
  as_of: string;
}

/** /api/summary: one day's figures from screen.json's own rows (worker/index.js `summarise`). `day` is the one-day move. */
export interface Summary {
  as_of: string | null;
  built_on: string | null;
  count: number;
  day: { up: number; down: number; flat: number; counted: number };
  above200: { above: number; withHistory: number };
  sectors: { name: string; n: number; median: number }[];
  /** IST dates of the Nifty's recent daily bars (the NSE's own sessions); absent or empty when unknown */
  sessions?: string[];
}

export interface Screen {
  ok: boolean;
  built_on: string;
  universe: string;
  count: number;
  breadth: Breadth;
  magic_formula: { ranked: number; universe: number; excluded: Record<string, number>; rules: Record<string, string> };
  vet: { cleared: number; held: number; total: number; by_check: Record<string, number> };
  rows: Row[];
}

export interface PulseMover {
  sym: string;
  name: string;
  sector: string;
  price: number;
  r1w: number;
  r1m: number;
  turnover_cr?: number;
  vol_spike?: number;
}
export interface PulseSector {
  name: string;
  n: number;
  median: number;
  up: number;
  top: { sym: string; name: string; price: number; r1d?: number; r1w: number; rsi: number }[];
  bottom: { sym: string; name: string; price: number; r1d?: number; r1w: number; rsi: number }[];
}
export interface Pulse {
  built_on: string;
  universe: number;
  sectors: PulseSector[];
  sectors_day: PulseSector[];
  movers_up: PulseMover[];
  movers_dn: PulseMover[];
  volume: PulseMover[];
  breadth: { counted: number; up: number; down: number; median: number; above_200dma: number; at_52w_high: number };
}

export interface Barometer {
  generated_at?: string;
  today: {
    score: number;
    band: { k: string; t: string; c: string };
    parts: { key: string; label: string; score: number; weight: number; detail: string }[];
    stage: { k: string; t: string; c: string };
    nifty: number;
    drawdown_pct: number;
    above_200dma_pct: number;
    vix: number;
    nifty_date: string;
    vix_date?: string;
    counted?: number;
  };
  history: { date: string; score: number; nifty: number; vix: number; nifty_date?: string }[];
}

export interface Regime {
  today: { regime: string; close: number; vol_ann_pct: number; vol_pctile: number; drawdown_pct: number; above_200dma: boolean; date: string; t: string; d: string };
  run_days: number;
}

export interface NewsItem { title: string; summary: string; source: string; link: string; published?: string }

export interface IpoOpen {
  symbol: string; company: string; phase: string; open_date: string; close_date: string; days_left: number;
  price_band: string; issue_size_cr: number; subscription_x: number | null; lot_size: number; min_investment: number; listing_date: string | null;
}
export interface IpoListed {
  symbol: string; company: string; price_band: string; close_date: string; listing_date: string | null;
  measured?: boolean; first_close?: number; last_close?: number; since_listing_pct?: number; from_high_pct?: number;
}
export interface IpoAwaiting {
  symbol: string; company: string; price_band: string; close_date: string; listing_date: string | null; lot_size: number;
  gmp_text?: string; revenue_cr?: number; pat_cr?: number; pe_post_issue?: number; peer_pe?: number; roce_pct?: number;
}
export interface IpoUpcoming extends IpoOpen {
  sector?: string | null; gmp_text?: string | null; revenue_cr?: number | null; pat_cr?: number | null;
  pe_post_issue?: number | null; peer_pe?: number | null; roce_pct?: number | null; enriched_url?: string | null; price_low?: number | null; price_high?: number | null;
  score?: { points: number; of: number; pct: number; parts: Record<string, string>; not_measured: string[]; shown_not_scored: string[] };
}
export interface IpoLiveIssue { symbol: string; company: string | null; status: string | null; price_band: string | null; opens: string | null; closes: string | null; total_x: number | null; categories?: { cat: string; x: number }[] }
export interface IpoLive { ok: boolean; at?: string; issues: IpoLiveIssue[]; error?: string }
export interface Ipo {
  generated_at: string;
  counts: Record<string, number>;
  open: IpoOpen[];
  upcoming: IpoUpcoming[];
  awaiting_listing: IpoAwaiting[];
  recent_listed: IpoListed[];
}

export interface Fund {
  name: string; code: number; house: string; category: string; isin: string; nav: number; nav_date: string; inception: string;
  history_years: number; r1: number | null; r3: number | null; r5: number | null; since_inception: number | null;
  dd3: number | null; volatility: number | null; calendar?: { year: number; ret: number }[];
  rolling3y?: { best: number; worst: number; median: number; windows: number; above_7pct: number };
  percentile_r3?: number;
  /** Holdings read from ETMoney by the data pipeline (trading-dashboard fund_portfolio.py); absent when not available. */
  portfolio?: { as_on: string; holdings_count: number; equity_pct: number | null; top_sectors: { name: string; pct: number }[]; top_stocks: { name: string; pct: number }[]; source_url?: string };
}
export interface Funds { generated_at: string; basis: string; categories: { key: string; label: string; blurb: string; funds: Fund[] }[] }

/** review: written by trading-dashboard's weekly_reads.py (A02). under_review means today's checks found a problem; the
 *  text is kept as published and a correction is a new study. reviewed_by_person is false for every machine-written study. */
export interface StudyReview { status: 'machine_checked' | 'under_review' | 'corrected'; problems: string[]; checked_at: string; reviewed_by_person: boolean }
export interface Study { sym: string; name: string; sector: string; industry: string; mcap_cr: number; price: number; read_minutes: number; facts: string[]; study: string; model?: string; corrections?: { date: string; fix: string }[]; review?: StudyReview }
export interface ReadsCorrection { date: string; week: string; sym: string; status: string; issue: string; action: string }
export interface Reads { generated_at: string; editions: { week: string; written_at: string; studies: Study[] }[]; corrections?: ReadsCorrection[] }

export interface Swot { s: { t: string; k: string }[]; w: { t: string; k: string }[]; o: { t: string; k: string }[]; t: { t: string; k: string }[] }
export interface SwotFeed { built_on: string; swot: Record<string, Swot> }

export interface Year {
  fy: string; end: string; rev_cr: number | null; ebitda_cr: number | null; ebit_cr: number | null; pat_cr: number | null; eps: number | null;
  roe: number | null; roce: number | null; ebit_margin: number | null; de: number | null; cfo_cr: number | null; fcf_cr: number | null;
}
export interface DetailFeed { built_on: string; detail: Record<string, { years: Year[] }> }

export interface InstRow { quality: string; fii: number | null; dii: number | null; promoter: number | null; publicHold: number | null; mf: number | null; insurance: number | null; fii_pp: number | null; dii_pp: number | null; period: string; series?: { p: string; f: number; d: number }[] }
export interface InstFeed { latest_period_end: string; source: string; rows: Record<string, InstRow> }

export interface SeasonFeed { years: number; months: string[]; caveats: string[]; stocks: Record<string, { m: [number, number, number][]; y: number }> }

export interface Quote {
  id: string; name: string; group: string; symbol: string; prefix: string; dp: number;
  price: number | null; prev?: number; pct?: number; series?: number[]; state?: string | null; at?: number | null; hi52?: number | null; lo52?: number | null; dayHi?: number | null; dayLo?: number | null;
}
export interface QuotesFeed { ok: boolean; fetched_at: string; live: number; total: number; quotes: Quote[] }

export interface DataHealth { generated_at: string; datasets: { dataset: string; source: string; last_successful_update: string; freshness_age: string; status: string }[] }

/** Swing v2 (engines/swing.py, swing_run.py): one rule book, a market gate, two setups, half at 2R, stop raised above entry, then a trail. */
export interface SigEvent { date: string; kind: 'entry' | 't1' | 't2' | 'stop' | 'lock' | 'trail' | 'time'; price: number; fraction: number }
export interface Sig {
  id: string; engine: 'swing'; sym: string; name: string; sector: string | null; setup: 'Pullback' | 'Breakout'; date: string;
  ref_price: number; sl: number; risk_pct: number; t1_plan: number; t2_plan: number; max_hold: number; why: string[]; first_seen: string;
  status: 'pending' | 'open' | 'closed' | 'void'; events: SigEvent[]; half: boolean;
  entry?: number; entry_date?: string; t1?: number; t2?: number; risk?: number; stop_now?: number; remaining?: number;
  r_open?: number; r_net?: number; exit_reason?: 'stop' | 'lock' | 'trail' | 't2' | 'time'; closed_date?: string; void_reason?: string;
  last_close?: number; last_close_date?: string; stop_raised_on?: string; stop_before?: number;
}
export interface GateCheck { rule: string; ok: boolean; value: string | null }
export interface BtStats {
  n: number; win_rate?: number; expectancy_r?: number; median_r?: number; avg_win_r?: number | null; avg_loss_r?: number | null; profit_factor?: number | null;
  t_stat?: number | null; max_dd_r?: number; avg_bars?: number; hit_t1?: number; hit_t2?: number; stopped?: number;
  clustered_months?: number; clustered_t_clustered?: number; clustered_positive_months_pct?: number;
  by_setup?: Record<string, BtStats>; exits?: Record<string, number>;
}
export type Period = 'development' | 'holdout';
export interface Backtest {
  version: string; generated: string; periods: Record<Period, [string, string]>; universe: number; gate_on_pct_by_year: Record<string, number>;
  rules: Record<Period | 'all', BtStats>; no_gate: Record<Period | 'all', BtStats>; random: Record<Period | 'all', BtStats>;
  curve: { rules: { m: string; r: number }[]; random: { m: string; r: number }[] }; notes: string[];
}
export interface SignalsFeed {
  schema: string; version: string; generated: string; data_through: string; launched: string;
  gate: { date: string; on: boolean; checks: GateCheck[]; passed: number }; gate_history: { d: string; on: boolean }[];
  rules: { gate: string[]; stock: string[]; setups: Record<string, string>; plan: string[]; book: string[] };
  params: Record<string, number>; cost_round_trip_pct: number; alertable: boolean; alert_why: string;
  record: { closed: number; wins: number; total_r: number; avg_r: number | null };
  backtest: Backtest | null; signals: Sig[];
}

export interface PxQuote { price: number; prev: number; pct: number; state: string | null; at: number | null }
export interface PxFeed { ok: boolean; fetched_at?: string; live?: number; requested?: number; quotes: Record<string, PxQuote> }

export interface ChartFeed { ok: boolean; sym: string; range: string; interval: string; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; nifty: (number | null)[]; error?: string }

export interface RotationFeed { generated: string; dates: string[]; nifty: number[]; groups: Record<string, { close: (number | null)[]; members: string[]; real_index: boolean }> }
