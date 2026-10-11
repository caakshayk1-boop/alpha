"""data.py — daily bars for the NSE universe the screen covers.

Prices are ADJUSTED for splits and dividends, because a split is a 50% 'crash' to any rule that
reads raw prices. The universe is whatever alpha's screen holds, so the engines and the site can
never disagree about which companies exist.
"""
from __future__ import annotations

import json
import pathlib
import sys
import time
import urllib.request

import pandas as pd
import yfinance as yf

ALPHA = "https://alpha.askakshay.workers.dev"
COLS = ["Open", "High", "Low", "Close", "Volume"]


def universe() -> list[dict]:
    """[{sym, name, sector, mcap_cr}] from the live screen."""
    req = urllib.request.Request(f"{ALPHA}/data/screen.json", headers={"User-Agent": "alpha-engines/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.load(r)["rows"]
    return [{"sym": x["sym"], "name": x["name"], "sector": x.get("sector"), "mcap_cr": x.get("mcap_cr")} for x in rows]


def download(symbols: list[str], period: str = "7y", chunk: int = 40, log=print) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    for i in range(0, len(symbols), chunk):
        part = symbols[i:i + chunk]
        tickers = [f"{s}.NS" for s in part]
        for attempt in range(3):
            try:
                df = yf.download(tickers, period=period, interval="1d", auto_adjust=True, group_by="ticker",
                                 threads=True, progress=False)
                break
            except Exception as e:  # noqa: BLE001
                log(f"  chunk {i} attempt {attempt + 1}: {type(e).__name__}")
                time.sleep(3)
        else:
            continue
        for s, t in zip(part, tickers):
            try:
                d = df[t][COLS].dropna(subset=["Close"]) if len(tickers) > 1 else df[COLS].dropna(subset=["Close"])
            except KeyError:
                continue
            d = d[(d["Close"] > 0) & (d["High"] >= d["Low"])]
            if len(d) >= 120:
                d.index = pd.to_datetime(d.index).tz_localize(None)
                out[s] = d
        log(f"  {min(i + chunk, len(symbols))}/{len(symbols)} requested, {len(out)} usable")
    return out


if __name__ == "__main__":
    dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "bars.pkl")
    uni = universe()
    print(f"universe {len(uni)}")
    bars = download([u["sym"] for u in uni])
    pd.to_pickle({"universe": uni, "bars": bars, "fetched": pd.Timestamp.utcnow().isoformat()}, dest)
    print(f"saved {len(bars)} symbols -> {dest}")
