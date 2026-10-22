"""sessions.py — the NSE trading calendar and finished-session bars rebuilt from hourly data.

Yahoo's daily download often has no row (or no Close) for the newest session for hours after the close: on 21 Oct 2026 the
22:30 IST run still found 940 of 941 stocks without a 21 Oct bar, so the whole Swing book described 19 Oct while the screen
(which rebuilds the day) described 21 Oct. A FINISHED session's daily bar is fully determined by its hourly bars (first open,
highest high, lowest low, last close, summed volume), so it is rebuilt from them, never invented: a session whose last hourly
bar ends before 15:15 IST is not finished and is not rebuilt. The calendar is configs/nse_holidays.json (the exchange's own
circular), the same list the site reads (src/lib/holidays.ts, held equal by tests/lib.test.ts)."""
from __future__ import annotations

import json
import pathlib
from datetime import date, datetime, timedelta, timezone

import pandas as pd

IST = timezone(timedelta(hours=5, minutes=30))
_CAL = json.loads((pathlib.Path(__file__).resolve().parent.parent / "configs" / "nse_holidays.json").read_text())
HOLIDAYS = {d for days in _CAL["weekday_holidays"].values() for d in days}
CLOSE_DONE = (16, 30)          # after 16:30 IST today's session counts as finished


def is_session(d: date) -> bool:
    return d.weekday() < 5 and d.isoformat() not in HOLIDAYS


def last_finished_session(now: datetime | None = None) -> date:
    """The newest NSE session that has closed at `now` (IST)."""
    now = (now or datetime.now(tz=IST)).astimezone(IST)
    d = now.date()
    if not (is_session(d) and (now.hour, now.minute) >= CLOSE_DONE):
        d -= timedelta(days=1)
        while not is_session(d):
            d -= timedelta(days=1)
    return d


def day_from_hourly(h: pd.DataFrame, session: date) -> dict | None:
    """One daily bar from the hourly bars of `session` (index tz-aware or IST-naive), or None when the session is not finished."""
    if h is None or not len(h):
        return None
    idx = pd.DatetimeIndex(h.index)
    idx = idx.tz_convert(IST) if idx.tz is not None else idx.tz_localize(IST)
    m = h.loc[(idx.date == session)]
    m = m.dropna(subset=["Open", "High", "Low", "Close"]) if len(m) else m
    if not len(m):
        return None
    last = (idx[idx.date == session])[-1]
    if (last.hour, last.minute) < (15, 15):           # the 15:15 IST hourly bar is the session's last; without it, not finished
        return None
    return {"Open": float(m["Open"].iloc[0]), "High": float(m["High"].max()), "Low": float(m["Low"].min()), "Close": float(m["Close"].iloc[-1]),
            "Volume": float(m["Volume"].fillna(0).sum()) if "Volume" in m else 0.0}


def append_day(df: pd.DataFrame, session: date, bar: dict) -> pd.DataFrame:
    """`df` with `bar` added as the `session` row (a daily frame, tz-naive index). An existing row for the session is kept."""
    ts = pd.Timestamp(session)
    if len(df) and df.index[-1] >= ts:
        return df
    row = {c: bar.get(c) for c in df.columns if c in bar}
    if "Adj Close" in df.columns and "Adj Close" not in bar:
        row["Adj Close"] = bar["Close"]               # no dividend factor is known for a rebuilt day: exchange price, stated
    return pd.concat([df, pd.DataFrame([row], index=[ts])])
