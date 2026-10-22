"""Calendar and hourly rebuild tests (no network). Run: python tests/test_sessions.py"""
import pathlib, sys
from datetime import date, datetime
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import pandas as pd
import sessions as S

ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)

check("20 Oct 2026 (Dussehra) is not a session", not S.is_session(date(2026, 10, 20)))
check("21 Oct 2026 is a session", S.is_session(date(2026, 10, 21)))
check("before the close, the last finished session is the previous one", S.last_finished_session(datetime(2026, 10, 21, 14, 0, tzinfo=S.IST)) == date(2026, 10, 19))
check("after 16:30 IST it is today", S.last_finished_session(datetime(2026, 10, 21, 22, 30, tzinfo=S.IST)) == date(2026, 10, 21))
check("on a Saturday it is Friday", S.last_finished_session(datetime(2026, 10, 24, 10, 0, tzinfo=S.IST)) == date(2026, 10, 23))

times = pd.date_range("2026-10-21 09:15", periods=7, freq="60min", tz=S.IST)
h = pd.DataFrame({"Open": [100, 101, 102, 103, 104, 105, 106], "High": [102, 103, 108, 104, 105, 106, 107], "Low": [99, 100, 101, 97, 103, 104, 105], "Close": [101, 102, 103, 104, 105, 106, 106.5], "Volume": [10, 20, 30, 40, 50, 60, 70]}, index=times)
b = S.day_from_hourly(h, date(2026, 10, 21))
check("a finished session rebuilds: first open, max high, min low, last close, summed volume", b == {"Open": 100.0, "High": 108.0, "Low": 97.0, "Close": 106.5, "Volume": 280.0}, b)
check("a session without its 15:15 bar is not finished: nothing rebuilt", S.day_from_hourly(h.iloc[:5], date(2026, 10, 21)) is None)
check("another day's bars rebuild nothing", S.day_from_hourly(h, date(2026, 10, 22)) is None)
daily = pd.DataFrame({"Open": [1.0], "High": [1.0], "Low": [1.0], "Close": [1.0], "Volume": [1.0], "Adj Close": [1.0]}, index=[pd.Timestamp("2026-10-19")])
out = S.append_day(daily, date(2026, 10, 21), b)
check("the rebuilt day is appended as its own session", list(out.index.date) == [date(2026, 10, 19), date(2026, 10, 21)] and out["Close"].iloc[-1] == 106.5 and out["Adj Close"].iloc[-1] == 106.5)
check("an existing row is never overwritten", S.append_day(out, date(2026, 10, 21), {**b, "Close": 1}).equals(out))

print(f"{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
