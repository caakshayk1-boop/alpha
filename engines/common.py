"""common.py — the signal type, the universe filter and the exit simulator every engine shares.

THE EXIT RULE (same for all four engines, so their results are comparable)
  Entry is the NEXT bar's open after the signal closes. Never the signal bar itself.
  Position is split into thirds: one third exits at T1, one at T2, the last at T3.
  After T1 the stop moves to entry (break-even). After T2 it moves to T1.
  A gap through the stop exits at that day's open, not at the stop price. A gap past a target
  fills at that day's open, not at the target.
  If one bar spans both the stop and a target, the STOP is assumed to hit first.
  If nothing has happened by `max_hold` bars the remainder exits at that day's close.
  Costs of COST_PCT per round trip (slippage, brokerage, taxes) are charged in R.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

COST_PCT = 0.0025          # 0.25% of entry price, round trip
SPLITS = (1 / 3, 1 / 3, 1 / 3)


@dataclass
class Signal:
    engine: str
    sym: str
    t: int                      # index of the signal bar (close known)
    date: pd.Timestamp
    ref_price: float            # the signal bar's close; entry will be the next open
    sl: float                   # stop (price)
    targets: list[float]        # T1 < T2 < T3
    max_hold: int               # bars
    setup: str                  # short name of what fired
    reasons: list[str] = field(default_factory=list)
    horizon: str = "swing"      # swing | positional | long
    meta: dict = field(default_factory=dict)


@dataclass
class Trade:
    engine: str
    sym: str
    signal_date: pd.Timestamp
    entry_date: pd.Timestamp
    exit_date: pd.Timestamp
    entry: float
    sl: float
    r: float                    # net R
    gross_r: float
    bars: int
    hit: int                    # number of targets reached (0-3)
    exit_reason: str            # stop | breakeven | target | time
    setup: str
    horizon: str
    t1_bars: int | None = None   # trading days from entry to the first target, when it was reached
    t3_bars: int | None = None
    bench_ok: bool | None = None  # all three benchmark conditions held on the signal day (None: no usable benchmark)


def liquid(df: pd.DataFrame, min_turnover_cr: float = 1.0, window: int = 20) -> pd.Series:
    """Median 20-day traded value, in crore rupees, at or above the floor. Trades in a stock nobody
    trades are not trades."""
    tv = (df["Close"] * df["Volume"]).rolling(window, min_periods=window).median() / 1e7
    return tv >= min_turnover_cr


def walk(df: pd.DataFrame, t_signal: int, sl: float, targets: list[float], max_hold: int) -> dict | None:
    """The single implementation of the exit rule, used by BOTH the backtest and the live tracker, so what is
    tested and what is tracked cannot drift apart.

    Returns None when there is no entry yet or ever (no next bar, or the setup was voided by the opening
    gap). Otherwise a dict: entry, entry_i, events [(bar index, kind, price, fraction)], hit, stop (the current
    stop), closed (bool), exit_i, exit_reason, pnl (price units, weighted by fraction already sold),
    remaining (fraction still held), risk.
    A position the data has not resolved yet has closed=False: it is open, not closed at today's price."""
    o, h, l, c = df["Open"].values, df["High"].values, df["Low"].values, df["Close"].values
    t0 = t_signal + 1
    if t0 >= len(df):
        return None
    entry = float(o[t0])
    if not (entry > 0 and sl < entry):
        return None
    t1, t2, t3 = targets
    if entry >= t1 or entry <= sl:
        return {"void": True, "entry": entry, "entry_i": t0}
    risk = entry - sl
    if risk / entry > 0.20 or risk / entry < 0.004:
        return {"void": True, "entry": entry, "entry_i": t0}
    remaining, pnl, stop, hit = 1.0, 0.0, sl, 0
    events: list[tuple[int, str, float, float]] = [(t0, "entry", entry, 1.0)]
    last = min(len(df) - 1, t0 + max_hold - 1)
    tgt = [t1, t2, t3]
    reason, exit_i, closed = "", t0, False
    for i in range(t0, last + 1):
        lo, hi, op = l[i], h[i], o[i]
        if lo <= stop or op <= stop:                      # the stop first, including a gap through it
            px = op if op < stop else stop
            pnl += remaining * (px - entry)
            events.append((i, "stop" if hit == 0 else "stop_after_t%d" % hit, float(px), remaining))
            reason = "stop" if hit == 0 else ("breakeven" if hit == 1 else "target")
            exit_i, remaining, closed = i, 0.0, True
            break
        while hit < 3 and hi >= tgt[hit]:                 # targets in order, several possible in one bar
            px = op if op > tgt[hit] else tgt[hit]
            frac = SPLITS[hit]
            pnl += frac * (px - entry)
            remaining -= frac
            hit += 1
            events.append((i, f"t{hit}", float(px), frac))
            stop = entry if hit == 1 else (t1 if hit == 2 else stop)
        if hit == 3:
            reason, exit_i, remaining, closed = "target", i, 0.0, True
            break
    if not closed and last == t0 + max_hold - 1 and t0 + max_hold - 1 <= len(df) - 1:
        # the time limit has arrived: whatever is left goes at that day's close
        pnl += remaining * (c[last] - entry)
        events.append((last, "time", float(c[last]), remaining))
        reason, exit_i, remaining, closed = "time", last, 0.0, True
    return {"void": False, "entry": entry, "entry_i": t0, "events": events, "hit": hit, "stop": stop, "closed": closed,
            "exit_i": exit_i, "exit_reason": reason, "pnl": pnl, "remaining": remaining, "risk": risk}


def simulate(df: pd.DataFrame, sig: Signal, cost_pct: float = COST_PCT) -> Trade | None:
    """Run one signal through the exit rule for the backtest. Trades the data has not resolved yet are left out
    rather than closed at an arbitrary price."""
    w = walk(df, sig.t, sig.sl, sig.targets, sig.max_hold)
    if w is None or w.get("void") or not w["closed"]:
        return None
    entry, risk = w["entry"], w["risk"]
    t0 = w["entry_i"]
    gross_r = w["pnl"] / risk
    r = gross_r - (cost_pct * entry) / risk
    t1b = next((e[0] - t0 + 1 for e in w["events"] if e[1] == "t1"), None)
    t3b = next((e[0] - t0 + 1 for e in w["events"] if e[1] == "t3"), None)
    return Trade(sig.engine, sig.sym, sig.date, df.index[t0], df.index[w["exit_i"]], entry, sig.sl, float(r), float(gross_r),
                 int(w["exit_i"] - t0 + 1), int(w["hit"]), w["exit_reason"], sig.setup, sig.horizon, t1b, t3b, sig.meta.get("bench_ok"))


def stats(trades: list[Trade]) -> dict:
    """Plain-numbers summary. t is mean/standard-error of the per-trade R, the number that says whether
    an average of +0.2R is signal or luck."""
    n = len(trades)
    if n == 0:
        return {"n": 0}
    r = np.array([t.r for t in trades])
    wins, losses = r[r > 0], r[r <= 0]
    sd = r.std(ddof=1) if n > 1 else 0.0
    se = sd / np.sqrt(n) if n > 1 else 0.0
    # equity in R, in exit order, for drawdown
    order = sorted(trades, key=lambda t: t.exit_date)
    eq = np.cumsum([t.r for t in order])
    peak = np.maximum.accumulate(np.concatenate([[0.0], eq]))[1:]
    dd = float((eq - peak).min())
    gw, gl = wins.sum(), -losses.sum()
    return {
        "n": n,
        "win_rate": round(float((r > 0).mean() * 100), 1),
        "expectancy_r": round(float(r.mean()), 3),
        "median_r": round(float(np.median(r)), 3),
        "avg_win_r": round(float(wins.mean()), 2) if len(wins) else None,
        "avg_loss_r": round(float(losses.mean()), 2) if len(losses) else None,
        "profit_factor": round(float(gw / gl), 2) if gl > 0 else None,
        "t_stat": round(float(r.mean() / se), 2) if se > 0 else None,
        "max_dd_r": round(dd, 1),
        "avg_bars": round(float(np.mean([t.bars for t in trades])), 1),
        "hit_t1": round(float(np.mean([t.hit >= 1 for t in trades]) * 100), 1),
        "hit_t2": round(float(np.mean([t.hit >= 2 for t in trades]) * 100), 1),
        "hit_t3": round(float(np.mean([t.hit >= 3 for t in trades]) * 100), 1),
        "stopped": round(float(np.mean([t.exit_reason == "stop" for t in trades]) * 100), 1),
    }


class Ctx:
    """Market-wide and sector-wide context the engines may read, all computed without lookahead.

    regime       True when the Nifty is above a rising 200-day average.
    rs126 / rs21 each stock's 126-day and 21-day return, ranked 0-100 across the universe that day.
    BENCHMARKS   every stock is measured against the index of its own group:
                   - Nifty IT, Nifty Pharma and Nifty Bank, the real NSE indices, where Yahoo holds their history
                     (technology, healthcare and banks);
                   - otherwise an equal-weighted index of the stock's industry group (its sector when the industry
                     has fewer than 8 liquid members), built from the universe and leave-one-out, so a stock is
                     never benchmarked against itself. Daily moves are capped at 15% so one bad print cannot
                     move a group.
    """

    MIN_GROUP = 8

    def __init__(self, bars: dict, bench: pd.Series, universe: list | None = None, indices: dict | None = None):
        self.bench = bench
        s200 = bench.rolling(200, min_periods=200).mean()
        self.regime = ((bench > s200) & (s200 > s200.shift(20))).fillna(False)
        closes = pd.DataFrame({s: d["Close"] for s, d in bars.items()})
        self.rs126 = closes.pct_change(126, fill_method=None).rank(axis=1, pct=True) * 100
        self.rs21 = closes.pct_change(21, fill_method=None).rank(axis=1, pct=True) * 100
        self.group_of: dict[str, str] = {}
        self.group_level: dict[str, pd.Series] = {}
        self.group_n: dict[str, int] = {}
        self._loo: dict[str, pd.Series] = {}
        if universe:
            self._build_groups(bars, closes, universe, indices or {})

    # ── group benchmarks ─────────────────────────────────────────
    def _build_groups(self, bars, closes, universe, indices):
        info = {u["sym"]: u for u in universe if u["sym"] in bars}
        # Point in time (swing-2.0.1, DECISIONS #2): a stock counts in its group's index on a date only if it was liquid on most
        # of the 250 sessions up to that date. It used to be judged once, on the LAST 250 bars of the download, so membership
        # in 2019 was decided by trading in 2026.
        liq_pit = pd.DataFrame({s: liquid(bars[s]).astype(float).rolling(250, min_periods=60).mean() > 0.6 for s in info}).reindex(closes.index)
        liq_pit = liq_pit.fillna(False).astype(bool)
        liq = {s: bool(liq_pit[s].iloc[-1]) for s in info}        # today's membership, for display (group_n) only
        self._liq_pit = liq_pit
        by_ind: dict[str, list[str]] = {}
        by_sec: dict[str, list[str]] = {}
        for s, u in info.items():
            if u.get("ind"):
                by_ind.setdefault(u["ind"], []).append(s)
            if u.get("sector"):
                by_sec.setdefault(u["sector"], []).append(s)
        rets = closes.pct_change(fill_method=None).clip(-0.15, 0.15)
        for s, u in info.items():
            ind, sec = u.get("ind"), u.get("sector")
            name = (u.get("name") or "").lower()
            # Yahoo's sector labels are coarse (LG Electronics is 'Technology', a hospital chain is 'Healthcare'), so the NSE
            # indices are used only where the company really belongs to them.
            if sec == "Financial Services" and " bank" in f" {name}" and "Nifty Bank" in indices:
                self.group_of[s] = "Nifty Bank"
            elif "Nifty IT" in indices and (ind == "Information Technology" or (not ind and sec == "Technology" and any(w in name for w in ("software", "infotech", "technolog", "systems", "info")))):
                self.group_of[s] = "Nifty IT"
            elif "Nifty Pharma" in indices and sec == "Healthcare" and not any(w in name for w in ("hospital", "diagnostic", "healthcare", "medical", "health")) and (ind in (None, "Healthcare")):
                self.group_of[s] = "Nifty Pharma"
            elif ind and len(by_ind.get(ind, [])) >= self.MIN_GROUP:
                self.group_of[s] = f"{ind} (alpha group index)"
            elif sec and len(by_sec.get(sec, [])) >= self.MIN_GROUP:
                self.group_of[s] = f"{sec} (alpha group index)"
        for name, series in indices.items():
            self.group_level[name] = series
            self.group_n[name] = 0
        members: dict[str, list[str]] = {}
        for s, g in self.group_of.items():
            members.setdefault(g, []).append(s)
        for g, syms in members.items():
            if g in self.group_level:
                continue
            r = rets[syms].where(liq_pit[syms])                     # a member's return counts only on dates it was liquid
            tot, cnt = r.sum(axis=1, skipna=True), r.count(axis=1)
            self.group_n[g] = int(sum(1 for x in syms if liq.get(x)))
            self.group_level[g] = ((tot / cnt.replace(0, np.nan)).fillna(0) + 1).cumprod() * 100
            # leave-one-out series are built lazily per stock (see bench_for)
            self._grp_tot = getattr(self, "_grp_tot", {})
            self._grp_tot[g] = (tot, cnt)
        self._rets = rets

    def has_group(self, sym: str) -> bool:
        return sym in self.group_of

    def bench_for(self, sym: str, idx: pd.DatetimeIndex) -> pd.Series | None:
        """Index level of this stock's benchmark, aligned to idx. Alpha group indices are leave-one-out."""
        g = self.group_of.get(sym)
        if g is None:
            return None
        key = sym
        if key not in self._loo:
            if g in getattr(self, "_grp_tot", {}):
                tot, cnt = self._grp_tot[g]
                own = self._rets[sym]
                own_ok = own.notna() & self._liq_pit[sym]          # leave out only what was put in
                t2 = tot - own.fillna(0).where(own_ok, 0)
                c2 = cnt - own_ok.astype(int)
                level = ((t2 / c2.replace(0, np.nan)).fillna(0) + 1).cumprod() * 100
            else:
                level = self.group_level[g]
            self._loo[key] = level
        return self._loo[key].reindex(idx, method="ffill")

    def group_name(self, sym: str) -> str | None:
        return self.group_of.get(sym)

    def sec_trend(self, sym: str, idx: pd.DatetimeIndex) -> pd.Series:
        """Benchmark above a rising 50-day average."""
        b = self.bench_for(sym, idx)
        if b is None:
            return pd.Series(False, index=idx)
        s50 = b.rolling(50, min_periods=50).mean()
        return ((b > s50) & (s50 > s50.shift(10))).fillna(False)

    def sec_lead(self, sym: str, idx: pd.DatetimeIndex, n: int = 63) -> pd.Series:
        """Benchmark's n-day return ahead of the Nifty's."""
        b = self.bench_for(sym, idx)
        if b is None:
            return pd.Series(False, index=idx)
        nb = self.bench.reindex(idx, method="ffill")
        return ((b / b.shift(n) - 1) > (nb / nb.shift(n) - 1)).fillna(False)

    def stk_lead(self, sym: str, close: pd.Series, n: int = 63) -> pd.Series:
        """Stock's n-day return ahead of its own benchmark's."""
        b = self.bench_for(sym, close.index)
        if b is None:
            return pd.Series(False, index=close.index)
        return ((close / close.shift(n) - 1) > (b / b.shift(n) - 1)).fillna(False)

    def regime_for(self, idx: pd.DatetimeIndex) -> pd.Series:
        return self.regime.reindex(idx, method="ffill").fillna(False).astype(bool)

    def rs(self, sym: str, idx: pd.DatetimeIndex, window: int = 126) -> pd.Series:
        panel = self.rs126 if window == 126 else self.rs21
        return panel[sym].reindex(idx) if sym in panel else pd.Series(np.nan, index=idx)


def tag_bench(sigs: list, ctx, sym: str, df: pd.DataFrame) -> list:
    """Record, on every signal, whether its own benchmark confirmed it: the benchmark in an uptrend, leading the
    Nifty, and the stock leading the benchmark. Nothing is filtered here. Confirmation is a label, so that its effect
    can be measured instead of assumed."""
    if not sigs:
        return sigs
    if ctx is None or not ctx.has_group(sym):
        for s in sigs:
            s.meta["bench_ok"] = None
        return sigs
    up, lead, stk = ctx.sec_trend(sym, df.index), ctx.sec_lead(sym, df.index), ctx.stk_lead(sym, df["Close"])
    for s in sigs:
        t = s.t
        s.meta["bench"] = {"uptrend": bool(up.iloc[t]), "leads_nifty": bool(lead.iloc[t]), "stock_leads": bool(stk.iloc[t])}
        s.meta["bench_ok"] = bool(up.iloc[t] and lead.iloc[t] and stk.iloc[t])
    return sigs


def sector_gate(ctx, sym: str, df: pd.DataFrame, opt: dict) -> pd.Series:
    """The benchmark conditions an engine asks for, as one boolean series. A stock with no usable benchmark
    can never pass a benchmark condition: no benchmark means no evidence."""
    ok = pd.Series(True, index=df.index)
    if ctx is None:
        return ok
    if opt.get("sec_trend"):
        ok &= ctx.sec_trend(sym, df.index)
    if opt.get("sec_lead"):
        ok &= ctx.sec_lead(sym, df.index)
    if opt.get("stk_lead"):
        ok &= ctx.stk_lead(sym, df["Close"])
    return ok
