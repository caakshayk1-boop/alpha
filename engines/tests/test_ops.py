"""Operations tests: provenance, job keys and locks, the alert outbox, the E6 collector and its arithmetic. No network, nothing is
sent, fixtures only. Run: python tests/test_ops.py"""
import json, pathlib, sys, tempfile, time
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
from v3 import e6, jobs, outbox, provenance as P, ledger as L

ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)

tmp = pathlib.Path(tempfile.mkdtemp())
IST = ZoneInfo("Asia/Kolkata")

# ── provenance ──
idx = pd.bdate_range("2026-01-01", periods=30)
bars = {"AAA": pd.DataFrame({"Close": np.linspace(100, 110, 30)}, index=idx), "BBB": pd.DataFrame({"Close": np.linspace(50, 40, 30)}, index=idx)}
dv = P.dataset_version(bars)
check("dataset version is stable for the same data and changes when a close changes", dv == P.dataset_version(dict(bars)) and dv != P.dataset_version({**bars, "AAA": bars["AAA"].assign(Close=bars["AAA"]["Close"] + 0.5)}))
check("dataset version does not depend on dict order", dv == P.dataset_version({"BBB": bars["BBB"], "AAA": bars["AAA"]}))
p = P.provenance("2026-10-23", "2026-10-25T12:00:00Z", dv, "AAA")
check("provenance names source, exchange, currency, session, observation and ingestion time, adjustment policy and dataset", P.missing(p) == [] and p["currency"] == "INR" and p["observed_at"].endswith("15:30:00+05:30"))
check("a record missing any provenance field is reported", P.missing({**p, "ingested_at": None}) == ["ingested_at"] and "dataset_version" in P.missing({}))

# ── job keys, locks, retries ──
k1 = jobs.job_key("NSE", "2026-10-23", {"E1": "v1.0.0", "E5": "v1.0.0"}, dv)
check("a job key is deterministic and order-free", k1 == jobs.job_key("NSE", "2026-10-23", {"E5": "v1.0.0", "E1": "v1.0.0"}, dv))
check("a different session, engine version or data version is a different job", len({k1, jobs.job_key("NSE", "2026-10-26", {"E1": "v1.0.0", "E5": "v1.0.0"}, dv), jobs.job_key("NSE", "2026-10-23", {"E1": "v1.1.0", "E5": "v1.0.0"}, dv), jobs.job_key("NSE", "2026-10-23", {"E1": "v1.0.0", "E5": "v1.0.0"}, "other")}) == 4)
calls = []
r = jobs.run_once(k1, lambda: calls.append(1) or "x", tmp / "j")
check("the first run does the work once", r["status"] == "done" and len(calls) == 1 and r["attempts"] == 1)
r = jobs.run_once(k1, lambda: calls.append(1), tmp / "j")
check("a duplicate job does nothing", r["status"] == "already_done" and len(calls) == 1)
k2 = "held"
(tmp / "j" / f"{k2}.lock").write_text("123")
r = jobs.run_once(k2, lambda: calls.append(1), tmp / "j")
check("a fresh lock is respected", r["status"] == "locked" and len(calls) == 1)
old = time.time() - 7200
import os; os.utime(tmp / "j" / f"{k2}.lock", (old, old))
r = jobs.run_once(k2, lambda: calls.append(1) or "ok", tmp / "j")
check("a crashed run's stale lock is taken over", r["status"] == "done" and len(calls) == 2)
n = {"c": 0}
def flaky():
    n["c"] += 1
    if n["c"] < 3: raise RuntimeError("provider outage")
    return "recovered"
sleeps = []
r = jobs.run_once("flaky", flaky, tmp / "j", retries=3, backoff=(1, 2), sleep=sleeps.append)
check("a provider outage is retried with back-off and then succeeds", r["status"] == "done" and r["attempts"] == 3 and sleeps == [1, 2])
r = jobs.run_once("dead", lambda: (_ for _ in ()).throw(ValueError("down")), tmp / "j", retries=2, backoff=(0,), sleep=lambda s: None)
check("retries are bounded, the failure is reported, and the lock is released", r["status"] == "failed" and r["attempts"] == 2 and not (tmp / "j" / "dead.lock").exists() and not (tmp / "j" / "dead.done").exists())
check("a failed key can be tried again by a later run", jobs.run_once("dead", lambda: "back", tmp / "j")["status"] == "done")
check("health: current, stale and unknown are different states", jobs.health("2026-10-23", date(2026, 10, 23))["status"] == "ok" and jobs.health("2026-10-22", date(2026, 10, 23)) == {"status": "stale", "watermark": "2026-10-22", "expected": "2026-10-23", "days_behind": 1} and jobs.health(None, date(2026, 10, 23))["status"] == "unknown")
check("structured log lines are JSON", json.loads(jobs.log("x", a=1))["event"] == "x")

# ── alert outbox ──
ob = tmp / "outbox.jsonl"
q = lambda **o: outbox.enqueue(ob, "u1", "E1:AAA:2026-10-23", "telegram", {"t": 1}, **{"engine_state": "VALIDATED", "bound_ok": True, "alerts_enabled": True, **o})
check("an unqualified engine's publication is refused", q(engine_state="RESEARCH").startswith("refused") and q(engine_state="PAPER").startswith("refused") and not ob.exists())
check("a qualification bound to another version or hash is refused", q(bound_ok=False).startswith("refused"))
check("alerts the owner has not enabled are refused", q(alerts_enabled=False).startswith("refused"))
check("a qualified publication is queued once per recipient, publication and channel", q() == "queued" and q() == "duplicate" and len(outbox.pending(ob)) == 1)
check("another channel or recipient is a separate message", outbox.enqueue(ob, "u1", "E1:AAA:2026-10-23", "email", {}, engine_state="VALIDATED", bound_ok=True, alerts_enabled=True) == "queued" and outbox.enqueue(ob, "u2", "E1:AAA:2026-10-23", "telegram", {}, engine_state="VALIDATED", bound_ok=True, alerts_enabled=True) == "queued" and len(outbox.pending(ob)) == 3)
sent = []
check("with delivery disabled (the default) nothing is sent and the sender is never called", outbox.drain(ob, lambda b: sent.append(b) or True) == 0 and not sent)
check("enabled delivery sends each message once; a failed one stays pending", outbox.drain(ob, lambda b: b["recipient"] == "u1", enabled=True) == 2 and len(outbox.pending(ob)) == 1 and outbox.drain(ob, lambda b: True, enabled=True) == 1 and outbox.pending(ob) == [] and outbox.drain(ob, lambda b: True, enabled=True) == 0)
check("the outbox chain verifies", L.verify(ob)[0])

# ── E6 ──
def raises(fn):
    try: fn(); return False
    except e6.BlockedData: return True
check("with no configured source E6 is BLOCKED_DATA", e6.state_for(e6.NullSource()) == "BLOCKED_DATA")
check("NullSource refuses announcements and statements instead of returning an empty list", raises(lambda: e6.NullSource().announcements("X", date(2026, 1, 1))) and raises(lambda: e6.NullSource().quarters("X")))
def series(eps, adj=None, start=date(2020, 3, 31)):
    out = []
    for i, v in enumerate(eps):
        m = start.month + 3 * i; y = start.year + (m - 1) // 12; mm = (m - 1) % 12 + 1
        end = date(y, mm, 28 if mm == 2 else 30 if mm in (4, 6, 9, 11) else 31)
        out.append(e6.Quarter(end, datetime(y, mm, 28, 16, 0, tzinfo=IST) + timedelta(days=45), v, 1.0 if adj is None else adj[i]))
    return out
# 21 quarters: a seasonal pattern with noise, then one quarter that jumps
base = [10, 12, 11, 14, 11, 13.5, 11.8, 15.1, 12.6, 14.2, 12.9, 16.3, 13.4, 15.9, 13.8, 17.2, 14.9, 16.4, 14.6, 18.0]
qs = series(base + [30.0])
last = qs[-1]
s = e6.seasonal_surprise(qs, last.end)
check("the seasonal surprise is the year-on-year change over the spread of earlier changes", s.z is not None and s.n_prior >= 8 and s.z > 1 and s.label == e6.LABEL and "consensus" in s.label)
chg = e6.yoy_changes(qs)
prior = [c[2] for c in chg if c[0] < last.published_at and c[1] != last.end]
import statistics
check("the denominator is the spread of the changes published before the quarter, and excludes the quarter itself", abs(s.sd - statistics.stdev(prior)) < 1e-12 and len(prior) == s.n_prior and last.end not in [c[1] for c in chg if c[0] < last.published_at])
future = series(base + [30.0, 99.0])
check("a later quarter's result cannot change an earlier surprise (no lookahead)", e6.seasonal_surprise(future, last.end).z == s.z)
few = series([10, 12, 11, 14, 11, 13.5, 11.8, 15.1, 12.6, 14.2])
r6 = e6.seasonal_surprise(few, few[-1].end)
check("fewer than eight prior changes: refused, with the count", r6.z is None and "prior changes" in r6.reason and r6.n_prior < 8)
flat = series([10, 10, 10, 10] * 5 + [12])
check("a zero denominator is refused, never divided", e6.seasonal_surprise(flat, flat[-1].end).z is None and "zero" in e6.seasonal_surprise(flat, flat[-1].end).reason)
noadj = [e6.Quarter(q.end, q.published_at, q.eps, None if i == 3 else q.adj_factor) for i, q in enumerate(qs)]
check("a quarter with no corporate-action adjustment is not used", all(c[1] != qs[3].end for c in e6.yoy_changes(noadj)))
split = series(base + [30.0], adj=[0.5] * 8 + [1.0] * 13)      # EPS before a 2-for-1 split halves on the new share basis
check("an adjustment factor changes the change it feeds", e6.yoy_changes(split) != e6.yoy_changes(qs))
check("a missing EPS is not used", all(c[1] != qs[5].end for c in e6.yoy_changes([e6.Quarter(q.end, q.published_at, None if i == 5 else q.eps, q.adj_factor) for i, q in enumerate(qs)])))
naive = [e6.Quarter(q.end, q.published_at.replace(tzinfo=None), q.eps, q.adj_factor) for q in qs]
check("a publication time without a timezone is not trusted", e6.yoy_changes(naive) == [])
sess = [date(2026, 10, 26) + timedelta(days=i) for i in range(10) if (date(2026, 10, 26) + timedelta(days=i)).weekday() < 5]
before = datetime(2026, 10, 27, 8, 30, tzinfo=IST); during = datetime(2026, 10, 27, 11, 0, tzinfo=IST); after = datetime(2026, 10, 27, 16, 30, tzinfo=IST)
check("published before the open, the same session is the first full one; during or after, the next", e6.first_full_session(before, sess) == date(2026, 10, 27) and e6.first_full_session(during, sess) == date(2026, 10, 28) and e6.first_full_session(after, sess) == date(2026, 10, 28))
check("no session on file means no entry date, not a guessed one", e6.first_full_session(datetime(2027, 1, 5, 17, 0, tzinfo=IST), sess) is None)
good = e6.Surprise(1.4, 3, 12, 2, e6.LABEL, None)
check("all three conditions together qualify", e6.qualifies(good, 0.02, 1.8) == (True, []))
check("each unmeasured or failing condition fails and says which", not e6.qualifies(good, None, 1.8)[0] and not e6.qualifies(good, 0.02, None)[0] and not e6.qualifies(good, -0.01, 1.8)[0] and not e6.qualifies(good, 0.02, 1.49)[0] and not e6.qualifies(e6.Surprise(0.99, 1, 9, 1, e6.LABEL, None), 0.02, 2)[0] and len(e6.qualifies(e6.Surprise(None, None, 3, None, e6.LABEL, "x"), None, None)[1]) == 3)
check("the stop is the first full session's low less a quarter ATR", abs(e6.invalidation(100.0, 4.0) - 99.0) < 1e-12)

# ── publisher fails closed on provenance; end to end: ledger -> feed -> health and funnel ──
from v3 import nightly as NI, publish as PB
good_prov = P.provenance("2026-10-23", "2026-10-25T12:00:00Z", dv, "AAA")
sig = {"id": "E1:AAA:2026-10-23", "engine": "E1", "symbol": "AAA", "state": "RESEARCH", "as_of": "2026-10-23", "provenance": good_prov}
res = {"engines": {"E1": {"state": "RESEARCH", "evidence": "x", "version": "v1.0.0"}}}
def raised(fn):
    try: fn(); return False
    except PB.MissingProvenance: return True
check("a paper signal without provenance is not published", raised(lambda: PB.build_feed(res, [], [{k: v for k, v in sig.items() if k != "provenance"}], [], "2026-10-23")))
check("an incomplete provenance block is not published either", raised(lambda: PB.build_feed(res, [], [{**sig, "provenance": {**good_prov, "dataset_version": None}}], [], "2026-10-23")))
check("a forming setup and a closed record need provenance too", raised(lambda: PB.build_feed(res, [{"id": "f", "engine": "E1"}], [], [], "2026-10-23")) and raised(lambda: PB.build_feed(res, [], [], [{"id": "c"}], "2026-10-23")))
fn = {"available": pd.Series({pd.Timestamp("2026-10-23"): 900}), "clean": pd.Series({pd.Timestamp("2026-10-23"): 890}), "liquid": pd.Series({pd.Timestamp("2026-10-23"): 500}),
      "setup": pd.Series({pd.Timestamp("2026-10-23"): 4}), "context": pd.Series({pd.Timestamp("2026-10-23"): 3})}
fun = NI.day_funnel(fn, pd.Timestamp("2026-10-23"), 3)
check("the day's funnel runs universe, clean, liquid, setup, context, and leaves the two later stages undecided rather than guessed", [fun[k] for k in ("available", "clean", "liquid", "setup", "context")] == [900, 890, 500, 4, 3] and fun["executable"] is None and fun["portfolio_selected"] is None)
check("a stage with no data is None, not zero", NI.day_funnel({}, pd.Timestamp("2026-10-23"), 0)["clean"] is None)
feed = PB.build_feed(res, [], [sig], [], "2026-10-23", extra={"funnel": {"E1": fun}, "health": jobs.health("2026-10-23", date(2026, 10, 23)), "provenance": good_prov, "job_key": k1})
check("the feed carries the funnel, health, provenance and job key beside the four views, and alerts stay off", feed["funnel"]["E1"]["setup"] == 4 and feed["health"]["status"] == "ok" and feed["provenance"]["dataset_version"] == dv and feed["job_key"] == k1 and feed["alerts_enabled"] is False and feed["paper"] == [sig])
lp = tmp / "e2e.jsonl"
check("end to end: the planted paper signal is recorded once in the ledger, the chain verifies, and the feed keeps it as paper not alert", L.append(lp, sig) and not L.append(lp, sig) and L.verify(lp)[0] and feed["validated"] == [] and feed["engines"]["E1"]["state"] == "RESEARCH")

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
