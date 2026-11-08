"""python apps/tripwire/ledger/test_bars.py : the conversion from a yfinance frame to bars, with a synthetic frame (no network)."""
import pathlib, sys
from datetime import datetime, timezone
import numpy as np, pandas as pd
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from bars import frame_to_bars, last_day, partial_last_row, refresh_stale

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
# the silent lag: a newest row missing a price is dropped (correct) and now REPORTED; a bar set that ends before the last completed session is fetched again, never invented
assert partial_last_row(frame(drop=7), "TCS.NS") == idx[7].date().isoformat(), "the dropped newest row is named"
assert partial_last_row(frame(drop=3), "TCS.NS") is None, "an incomplete row in the middle is not the lag"
assert partial_last_row(frame(), "TCS.NS") is None
short = frame_to_bars(frame().iloc[:7], "TCS.NS"); full = frame_to_bars(frame(), "TCS.NS")
assert last_day(short) == idx[6].date().isoformat() and last_day(full) == idx[7].date().isoformat()
out = {"A.NS": short, "B.NS": full}; calls = []
def fetch(ts): calls.append(list(ts)); return {t: full for t in ts}
waits = []
left = refresh_stale(fetch, out, idx[7].date().isoformat(), ["A.NS", "B.NS"], tries=2, wait=5, sleep=waits.append)
assert left == [] and calls == [["A.NS"]] and waits == [5] and out["A.NS"] is full, "only the behind ticker is refetched, once it catches up the loop stops"
out = {"A.NS": short}; waits = []
left = refresh_stale(lambda ts: {t: short for t in ts}, out, idx[7].date().isoformat(), ["A.NS"], tries=2, wait=5, sleep=waits.append)
assert left == ["A.NS"] and waits == [5, 5] and out["A.NS"] is short, "a ticker that never catches up is reported, and its bars are left as they were"
assert refresh_stale(fetch, {"A.NS": short}, None, ["A.NS"], sleep=waits.append) == [], "no expected session, nothing to compare"
print("bars.py: 15 checks passed")

# Yahoo can publish a complete daily O/H/L but leave Close NaN for a day.
# Only the completed final hourly bar may supply that one missing observation.
from bars import recover_session_close, recover_stale_closes
D = idx[-1].date().isoformat(); NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
daily = frame(drop=7)
for field, value in [('Open',100),('High',110),('Low',90)]: daily.loc[idx[-1],(field,'TCS.NS')] = value
hx = pd.date_range(f'{D} 09:15', periods=7, freq='h', tz='Asia/Kolkata')
hourly = pd.DataFrame({('Close','TCS.NS'): [100,101,102,103,104,105,106]}, index=hx)
fixed = recover_session_close(daily,hourly,'TCS.NS',D,NOW)
assert fixed is not None and fixed.iloc[-1]['Close'] == 106
assert pd.isna(daily.iloc[-1][('Close','TCS.NS')]), 'the original frame is never mutated'
assert fixed.iloc[-1]['Open'] == 100 and fixed.iloc[-1]['High'] == 110 and fixed.iloc[-1]['Low'] == 90
assert last_day(frame_to_bars(fixed,'TCS.NS',NOW)) == D
assert recover_session_close(daily,hourly.iloc[:-1],'TCS.NS',D,NOW) is None, 'missing final 15:15 bar cannot supply a close'
assert recover_session_close(daily,hourly,'TCS.NS',D,datetime(2026,10,21,9,tzinfo=timezone.utc)) is None, 'do not close a forming session'
assert recover_session_close(daily,hourly,'TCS.NS','2026-10-20',NOW) is None, 'wrong session'
bad = hourly.copy(); bad.iloc[-1,0] = 111
assert recover_session_close(daily,bad,'TCS.NS',D,NOW) is None, 'hourly price outside daily range is rejected'
bad.iloc[-1,0] = np.nan
assert recover_session_close(daily,bad,'TCS.NS',D,NOW) is None, 'missing final close stays missing'
nozone = hourly.copy(); nozone.index = nozone.index.tz_localize(None)
assert recover_session_close(daily,nozone,'TCS.NS',D,NOW) is None, 'unknown timezone cannot identify a session'
assert recover_session_close(frame(),hourly,'TCS.NS',D,NOW) is None, 'never overwrite an existing daily close'
bad_daily = daily.copy(); bad_daily.loc[idx[-1],('Open','TCS.NS')] = np.nan
assert recover_session_close(bad_daily,hourly,'TCS.NS',D,NOW) is None, 'missing daily open is not guessed'
flat = daily.xs('TCS.NS',level=1,axis=1); hf = hourly.xs('TCS.NS',level=1,axis=1)
assert recover_session_close(flat,hf,'TCS.NS',D,NOW).iloc[-1]['Close'] == 106, 'single-ticker frames work too'
short = frame_to_bars(daily,'TCS.NS',NOW); out={'TCS.NS':short}; calls=[]
def hourly_fetch(ts): calls.append(ts); return hourly
assert recover_stale_closes(hourly_fetch,{'TCS.NS':daily},out,D,['TCS.NS'],NOW) == ['TCS.NS']
assert calls == [['TCS.NS']] and last_day(out['TCS.NS']) == D
assert out['TCS.NS']['t'][:-1] == short['t'] and out['TCS.NS']['c'][:-1] == short['c'], 'prior bars remain identical'
assert recover_stale_closes(hourly_fetch,{'TCS.NS':daily},out,D,['TCS.NS'],NOW) == [], 'replaying a recovered session does not append duplicates'
def failed_fetch(ts): raise RuntimeError('test provider outage')
out={'TCS.NS':short}
assert recover_stale_closes(failed_fetch,{'TCS.NS':daily},out,D,['TCS.NS'],NOW) == [] and out['TCS.NS'] is short, 'outage preserves prior prices'
print('bars.py: missing-close recovery checks passed')


from bars import through_session
later = pd.concat([daily, daily.iloc[-1:].set_axis(pd.DatetimeIndex(['2026-10-24'], tz='Asia/Kolkata'))])
trimmed = through_session(later, D)
assert len(trimmed) == len(daily) and len(later) == len(daily) + 1
assert partial_last_row(trimmed, 'TCS.NS') == D
assert recover_session_close(trimmed, hourly, 'TCS.NS', D, NOW) is not None
print('bars.py: expected-session scope checks passed')
