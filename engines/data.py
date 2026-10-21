"""data.py — daily bars for the NSE universe the screen covers.

Two views of the same bars. ADJUSTED (splits and dividends) feeds the models, because a dividend gap is not a move the
model should learn from. EXCHANGE prices (splits only, what NSE printed, what a broker and TradingView show) price and
track every live signal: a plan's entry, stop and targets must be prices a trader can actually see. Yahoo re-scales the
adjusted history at every ex-date, so a plan written in adjusted prices drifts off the real price (MRPL, 19 Oct 2026: ₹170.72
adjusted against ₹173.72 traded) and the stop can be 'hit' by an adjustment rather than a trade. The universe is whatever alpha's screen holds, so the engines and the site can
never disagree about which companies exist.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import time
import urllib.request

import pandas as pd
import yfinance as yf

ALPHA = os.environ.get("ALPHA_BASE", "https://alpha.askakshay.com")
COLS = ["Open", "High", "Low", "Close", "Volume"]


def universe() -> list[dict]:
    """[{sym, name, sector, mcap_cr}] from the live screen."""
    req = urllib.request.Request(f"{ALPHA}/data/screen.json", headers={"User-Agent": "alpha-engines/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.load(r)["rows"]
    return [{"sym": x["sym"], "name": x["name"], "sector": x.get("sector"), "ind": x.get("ind"), "mcap_cr": x.get("mcap_cr")} for x in rows]


NSE_INDICES = {"Nifty IT": "^CNXIT", "Nifty Pharma": "^CNXPHARMA", "Nifty Bank": "^NSEBANK"}   # the only sector indices with real daily history on Yahoo


def indices(period: str = "7y") -> dict[str, pd.Series]:
    out = {}
    for name, t in NSE_INDICES.items():
        d = yf.download(t, period=period, interval="1d", auto_adjust=True, progress=False)
        c = d["Close"]
        c = (c.iloc[:, 0] if hasattr(c, "columns") else c).dropna()
        if len(c) > 200:
            c.index = pd.to_datetime(c.index).tz_localize(None)
            out[name] = c
    return out


def _split(d: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(adjusted, exchange) from one auto_adjust=False frame. Yahoo's Close is split-adjusted only; Adj Close adds dividends."""
    ex = d[COLS].copy()
    adj = ex.copy()
    if "Adj Close" in d:
        f = (d["Adj Close"] / d["Close"]).where(lambda x: (x > 0) & (x <= 1.0001)).fillna(1.0)
        for c in ("Open", "High", "Low", "Close"):
            adj[c] = ex[c] * f
    return adj, ex


def download(symbols: list[str], period: str = "7y", chunk: int = 40, log=print, with_exchange: bool = False):
    """{sym: adjusted bars}; with_exchange=True returns ({sym: adjusted}, {sym: exchange-price bars}) on the same dates."""
    out: dict[str, pd.DataFrame] = {}
    raw: dict[str, pd.DataFrame] = {}
    for i in range(0, len(symbols), chunk):
        part = symbols[i:i + chunk]
        tickers = [f"{s}.NS" for s in part]
        for attempt in range(3):
            try:
                df = yf.download(tickers, period=period, interval="1d", auto_adjust=False, group_by="ticker",
                                 threads=True, progress=False)
                break
            except Exception as e:  # noqa: BLE001
                log(f"  chunk {i} attempt {attempt + 1}: {type(e).__name__}")
                time.sleep(3)
        else:
            continue
        for s, t in zip(part, tickers):
            try:
                d = df[t] if len(tickers) > 1 else df
                d = d[[c for c in COLS + ["Adj Close"] if c in d]].dropna(subset=["Close"])
            except KeyError:
                continue
            d = d[(d["Close"] > 0) & (d["High"] >= d["Low"])]
            if len(d) >= 120:
                d.index = pd.to_datetime(d.index).tz_localize(None)
                out[s], raw[s] = _split(d)
        log(f"  {min(i + chunk, len(symbols))}/{len(symbols)} requested, {len(out)} usable")
    return (out, raw) if with_exchange else out


def refetch_late(adj: dict, raw: dict, period: str, waits=(60, 180), log=print) -> list[str]:
    """Stocks whose newest bar trails the newest bar of the universe (19 Oct 2026: 26 of 31 open signals were marked on the
    16 Oct close because their 19 Oct bar was not yet on Yahoo at 18:00 IST). Download those again, a few minutes later,
    and keep what arrived. Returns the symbols still late, so the run can say so."""
    if not adj:
        return []
    newest = max(df.index[-1] for df in adj.values())
    late = sorted(s for s, df in adj.items() if df.index[-1] < newest)
    for w in waits:
        if not late:
            break
        log(f"  {len(late)} stocks have no {newest.date()} bar yet: waiting {w}s and fetching them again")
        time.sleep(w)
        a2, r2 = download(late, period=period, log=lambda *_: None, with_exchange=True)
        for s_ in a2:
            if a2[s_].index[-1] > adj[s_].index[-1]:
                adj[s_], raw[s_] = a2[s_], r2[s_]
        late = sorted(s_ for s_ in late if adj[s_].index[-1] < newest)
    return late


if __name__ == "__main__":
    dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "bars.pkl")
    uni = universe()
    print(f"universe {len(uni)}")
    bars, exchange = download([u["sym"] for u in uni], with_exchange=True)
    pd.to_pickle({"universe": uni, "bars": bars, "exchange": exchange, "indices": indices(), "fetched": pd.Timestamp.utcnow().isoformat()}, dest)
    print(f"saved {len(bars)} symbols -> {dest}")
