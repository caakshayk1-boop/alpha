"""Fetch daily bars for the symbols the ledger still needs, through yfinance (a raw request to Yahoo from a CI runner is refused without
yfinance's cookie-and-crumb handshake, which is why this is not done in Node). Reads need.json, writes bars.json.
Prices are the traded, split-adjusted ones (auto_adjust=False, 'Close' not 'Adj Close'), the same basis as the app's Worker.
A bar's time is 09:15 India time on its date, so a pick written at the 15:30 close fills on the next date's bar.
  python apps/tripwire/ledger/bars.py            (after `record.ts record`)"""
from __future__ import annotations
import json, pathlib, sys
from datetime import datetime, timedelta, timezone

HERE = pathlib.Path(__file__).resolve().parent
IST = timezone(timedelta(hours=5, minutes=30))
FIELDS = ("Open", "High", "Low", "Close")


def frame_to_bars(df, ticker: str, now: datetime | None = None):
    """One ticker's columns of a yfinance frame -> {t,o,h,l,c,forming}. A day missing any price is dropped, never filled. None if too thin."""
    import pandas as pd
    now = now or datetime.now(timezone.utc)
    cols = df.columns
    if isinstance(cols, pd.MultiIndex):
        sub = pd.DataFrame({f: df[(f, ticker)] for f in FIELDS if (f, ticker) in cols})
    else:
        sub = df[[f for f in FIELDS if f in cols]]
    if len(sub.columns) < 4:
        return None
    sub = sub.dropna()
    sub = sub[(sub > 0).all(axis=1)]
    if len(sub) < 5:
        return None
    t, o, h, l, c = [], [], [], [], []
    for ts, row in sub.iterrows():
        d = ts.date() if hasattr(ts, "date") else ts
        opened = datetime(d.year, d.month, d.day, 9, 15, tzinfo=IST)
        t.append(int(opened.timestamp())); o.append(round(float(row["Open"]), 2)); h.append(round(float(row["High"]), 2)); l.append(round(float(row["Low"]), 2)); c.append(round(float(row["Close"]), 2))
    last_open = datetime.fromtimestamp(t[-1], IST)
    n = now.astimezone(IST)
    forming = last_open.date() == n.date() and (n.hour, n.minute) < (15, 45)
    return {"t": t, "o": o, "h": h, "l": l, "c": c, "forming": forming}


def main() -> int:
    import yfinance as yf
    need = json.loads((HERE / "need.json").read_text())["symbols"]
    out: dict[str, dict | None] = {}
    tickers = [f"{s}.NS" for s in need] + ["^NSEI"]
    for i in range(0, len(tickers), 40):                     # batched, group_by column: one request per chunk, not per symbol
        chunk = tickers[i:i + 40]
        try:
            df = yf.download(chunk, period="1y", interval="1d", auto_adjust=False, group_by="column", progress=False, threads=True)
        except Exception as e:                               # a failed chunk is logged and counted, never silent
            print(f"chunk {i // 40} failed: {e}", file=sys.stderr)
            df = None
        for tk in chunk:
            out[tk] = frame_to_bars(df, tk) if df is not None and len(df) else None
    (HERE / "bars.json").write_text(json.dumps({"bars": {k.removesuffix(".NS"): v for k, v in out.items()}}))
    got = sum(1 for k, v in out.items() if v and k != "^NSEI")
    print(f"yfinance: bars for {got} of {len(need)} symbols; nifty {'ok' if out.get('^NSEI') else 'MISSING'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
