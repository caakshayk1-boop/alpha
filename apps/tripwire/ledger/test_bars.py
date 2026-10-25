"""python apps/tripwire/ledger/test_bars.py : the conversion from a yfinance frame to bars, with a synthetic frame (no network)."""
import pathlib, sys
from datetime import datetime, timezone
import numpy as np, pandas as pd
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bars import frame_to_bars

idx = pd.date_range("2026-10-12", periods=8, freq="B", tz="Asia/Kolkata")
def frame(tick="TCS.NS", drop=None):
    cols = pd.MultiIndex.from_product([["Open", "High", "Low", "Close", "Volume"], [tick, "^NSEI"]])
    df = pd.DataFrame(np.random.default_rng(1).uniform(100, 110, (8, 10)), index=idx, columns=cols)
    df[("High", tick)] += 5; df[("Low", tick)] -= 5
    if drop is not None: df.loc[idx[drop], ("Close", tick)] = np.nan
    return df
b = frame_to_bars(frame(), "TCS.NS", now=datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc))
assert b and len(b["t"]) == 8 and b["forming"] is False
assert datetime.fromtimestamp(b["t"][0], timezone.utc).strftime("%H:%M") == "03:45", "bar time is 09:15 IST"
f = frame(); assert b["o"] == [round(float(x), 2) for x in f[("Open", "TCS.NS")]] and b["c"] == [round(float(x), 2) for x in f[("Close", "TCS.NS")]] and b["h"] == [round(float(x), 2) for x in f[("High", "TCS.NS")]], "each field maps to its own column"
assert len(frame_to_bars(frame(drop=3), "TCS.NS")["t"]) == 7, "a day missing its close is dropped, never filled"
last = datetime.fromtimestamp(b["t"][-1], timezone.utc)
assert frame_to_bars(frame(), "TCS.NS", now=last.replace(hour=7, minute=0))["forming"] is True, "12:30 IST on the last bar's day: still forming"
assert frame_to_bars(frame(), "TCS.NS", now=last.replace(hour=11, minute=0))["forming"] is False, "16:30 IST: closed"
assert frame_to_bars(frame(), "MISSING.NS") is None
assert frame_to_bars(frame().iloc[:3], "TCS.NS") is None, "three bars are too thin to replay"
print("bars.py: 7 checks passed")
