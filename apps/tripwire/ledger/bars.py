"""Fetch daily bars for the symbols the ledger still needs, through yfinance (a raw request to Yahoo from a CI runner is refused without
yfinance's cookie-and-crumb handshake, which is why this is not done in Node). Reads need.json, writes bars.json.
Prices are the traded, split-adjusted ones (auto_adjust=False, 'Close' not 'Adj Close'), the same basis as the app's Worker.
A bar's time is 09:15 India time on its date, so a pick written at the 15:30 close fills on the next date's bar.
  python apps/tripwire/ledger/bars.py            (after `record.ts record`)"""
from __future__ import annotations
import json, os, pathlib, sys, time
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


def last_day(b) -> str | None:
    """The India date of a bar set's newest bar, or None."""
    return datetime.fromtimestamp(b["t"][-1], IST).date().isoformat() if b and b.get("t") else None


def partial_last_row(df, ticker: str) -> str | None:
    """The date of the newest row of a ticker's frame when it exists but is missing a price (frame_to_bars drops such a day). Yahoo publishes the latest session
    incomplete for hours after the close; the drop is correct (a day is never filled) but it used to be silent, and left the outcome stage a session behind the pick stage."""
    import pandas as pd
    cols = df.columns
    if isinstance(cols, pd.MultiIndex):
        if not all((f, ticker) in cols for f in FIELDS): return None
        sub = pd.DataFrame({f: df[(f, ticker)] for f in FIELDS})
    else:
        if not all(f in cols for f in FIELDS): return None
        sub = df[list(FIELDS)]
    if not len(sub): return None
    ts = sub.index[-1]
    return str(ts.date() if hasattr(ts, "date") else ts) if sub.iloc[-1].isna().any() else None


def refresh_stale(fetch, out: dict, expect: str | None, tickers: list[str], tries: int = 2, wait: float = 90.0, sleep=time.sleep) -> list[str]:
    """Tickers whose newest bar is older than `expect` (the newest completed session) are fetched again, `tries` times, `wait` seconds apart: the bar for a finished session
    is often published a little after the rest. `fetch(list_of_tickers)` returns {ticker: bars|None}. Returns the tickers still behind. A bar is never invented."""
    def behind(): return [t for t in tickers if expect and (last_day(out.get(t)) or "") < expect]
    for i in range(tries):
        todo = behind()
        if not todo: break
        sleep(wait)
        for t, b in fetch(todo).items():
            if b and (last_day(b) or "") >= (last_day(out.get(t)) or ""): out[t] = b
    return behind()


def recover_session_close(daily, hourly, ticker: str, expect: str, now: datetime | None = None):
    """Recover ONLY a missing Close from the completed session's final hourly
    bar. Daily O/H/L must exist and contain that close. Uses traded prices on
    both feeds (auto_adjust=False), as the screen publisher already does.
    Returns a copy in single-ticker format, or None; never modifies its inputs.
    """
    import math
    import pandas as pd
    if daily is None or hourly is None or not len(daily) or not len(hourly): return None
    n = (now or datetime.now(timezone.utc)).astimezone(IST)
    if not expect or expect > n.date().isoformat() or (expect == n.date().isoformat() and (n.hour, n.minute) < (15, 45)): return None
    if isinstance(daily.columns, pd.MultiIndex):
        if not all((f, ticker) in daily.columns for f in FIELDS): return None
        sub = pd.DataFrame({f: daily[(f, ticker)] for f in FIELDS})
    else:
        if not all(f in daily.columns for f in FIELDS): return None
        sub = daily[list(FIELDS)].copy()
    ts = sub.index[-1]
    if str(ts.date()) != expect or not pd.isna(sub.iloc[-1]['Close']): return None
    o, h, l = (float(sub.iloc[-1][f]) for f in ('Open', 'High', 'Low'))
    if not all(math.isfinite(x) and x > 0 for x in (o, h, l)) or not l <= o <= h: return None
    if isinstance(hourly.columns, pd.MultiIndex):
        if ('Close', ticker) not in hourly.columns: return None
        close = hourly[('Close', ticker)]
    else:
        if 'Close' not in hourly.columns: return None
        close = hourly['Close']
    # A timezone-less intraday timestamp cannot establish the NSE session.
    if not isinstance(close.index, pd.DatetimeIndex) or close.index.tz is None: return None
    ix = close.index.tz_convert(IST)
    final = close[(ix.strftime('%Y-%m-%d') == expect) & (ix.hour == 15) & (ix.minute == 15)]
    if len(final) != 1: return None
    value = float(final.iloc[0])
    if not math.isfinite(value) or not l <= value <= h: return None
    sub.loc[ts, 'Close'] = value
    return sub


def recover_stale_closes(fetch_hourly, frames: dict, out: dict, expect: str | None, tickers: list[str], now: datetime | None = None) -> list[str]:
    """Bounded secondary fetch, only for stale tickers with an incomplete last
    daily row. Preserve every prior bar set if retrieval or validation fails.
    """
    if not expect: return []
    pending = [t for t in tickers if (last_day(out.get(t)) or '') < expect and t in frames and partial_last_row(frames[t], t) == expect]
    recovered = []
    for i in range(0, len(pending), 40):
        chunk = pending[i:i + 40]
        try:
            hourly = fetch_hourly(chunk)
        except Exception as e:
            print(f'hourly close recovery failed: {e}', file=sys.stderr); continue
        for ticker in chunk:
            fixed = recover_session_close(frames[ticker], hourly, ticker, expect, now)
            bars = frame_to_bars(fixed, ticker, now) if fixed is not None else None
            if bars and last_day(bars) == expect:
                out[ticker] = bars; recovered.append(ticker)
    return recovered


def through_session(df, expect: str | None):
    """Ignore later provider rows before checking/recovering the expected close.
    The TypeScript consumer also enforces calendar days and completed bars.
    """
    if df is None or not expect: return df
    return df.loc[df.index.strftime('%Y-%m-%d') <= expect].copy()


def main() -> int:
    import yfinance as yf
    spec = json.loads((HERE / "need.json").read_text())
    need = spec["symbols"]; expect = spec.get("expect")      # expect: the newest completed NSE session (written by record.ts from the exchange calendar)
    out: dict[str, dict | None] = {}; partial: dict[str, str] = {}; frames = {}
    tickers = [f"{s}.NS" for s in need] + ["^NSEI"]
    for i in range(0, len(tickers), 40):                     # batched, group_by column: one request per chunk, not per symbol
        chunk = tickers[i:i + 40]
        try:
            df = yf.download(chunk, period="1y", interval="1d", auto_adjust=False, group_by="column", progress=False, threads=True)
        except Exception as e:                               # a failed chunk is logged and counted, never silent
            print(f"chunk {i // 40} failed: {e}", file=sys.stderr)
            df = None
        df = through_session(df, expect)
        for tk in chunk:
            if df is not None and len(df): frames[tk] = df
            out[tk] = frame_to_bars(df, tk) if df is not None and len(df) else None
            d = partial_last_row(df, tk) if df is not None and len(df) else None
            if d: partial[tk] = d

    def fetch(ts: list[str]) -> dict:
        try:
            f = yf.download(ts, period="1y", interval="1d", auto_adjust=False, group_by="column", progress=False, threads=True)
        except Exception as e:
            print(f"retry failed: {e}", file=sys.stderr); return {}
        f = through_session(f, expect)
        for t in ts:
            if f is not None and len(f): frames[t] = f
            d = partial_last_row(f, t) if f is not None and len(f) else None
            if d: partial[t] = d
        return {t: frame_to_bars(f, t) if f is not None and len(f) else None for t in ts}

    stale = refresh_stale(fetch, out, expect, [t for t in tickers if out.get(t)], wait=float(os.environ.get("BARS_RETRY_WAIT", "90")))
    recovered = recover_stale_closes(
        lambda ts: yf.download(ts, period="5d", interval="1h", auto_adjust=False, group_by="column", progress=False, threads=False),
        frames, out, expect, tickers)
    stale = [t for t in tickers if expect and (last_day(out.get(t)) or "") < expect]
    print(f"yfinance: recovered {len(recovered)} missing daily closes from the completed final hourly bar")
    (HERE / "bars.json").write_text(json.dumps({"bars": {k.removesuffix(".NS"): v for k, v in out.items()}, "meta": {"expect": expect, "recovered_close": {t.removesuffix(".NS"): {"day": expect, "source": "Yahoo final hourly close; daily O/H/L"} for t in recovered}, "stale": [t.removesuffix(".NS") for t in stale], "partial_last_row": {k.removesuffix(".NS"): v for k, v in partial.items()}}}))
    got = sum(1 for k, v in out.items() if v and k != "^NSEI")
    print(f"yfinance: bars for {got} of {len(need)} symbols; nifty {'ok' if out.get('^NSEI') else 'MISSING'}")
    if expect and (stale or partial):
        print(f"yfinance: {len(stale)} symbols still end before the last completed session {expect}: {', '.join(t.removesuffix('.NS') for t in stale[:20])}; {len(partial)} had a newest row missing a price, ({len(recovered)} recovered from a validated final hourly bar; unresolved rows remain dropped)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
