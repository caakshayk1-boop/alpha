"""The signal brief: one short message a day about the Swing v2 paper book, built only from public/signals.json.

No model writes it and nothing in it is scored or predicted. It says, in this order: whether the data is current, whether the
market gate lets the rules file anything, which paper setups are new (with the levels and the ways each could fail), what changed in
the open paper book, and, on Sundays, whether the live paper record agrees with the backtest. Alerts stay off while the engine's own
eligibility rule says so; the brief repeats that reason at the top instead of burying it.

  python brief.py            write public/signal_brief.json (the text is inside it)
  python brief.py --weekly   the same, with the Sunday review block
  python brief.py --send     send the saved text to Telegram, only when TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID and BRIEF_SEND=1 exist

Sending is the owner's decision: with any of the three missing, --send prints that delivery is off and exits 0.
Paper only. Not advice. Alpha places no order. """
from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
FEED = HERE.parent / "public" / "signals.json"
OUT = HERE.parent / "public" / "signal_brief.json"
MIN_CLOSED = 30           # closed paper trades before a paper average is compared with the backtest (the desk's own floor)
LIMIT = 3900              # Telegram allows 4096 characters; leave room
CAVEATS = [
    "A gap through the stop can lose more than the planned risk.",
    "Entry is the next session's open and is skipped if it is more than 2% above the signal close.",
    "Costs are modelled at {cost}% a round trip; real fills can differ.",
]


def _d(s: str | None) -> date | None:
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None


def _day(s: str | None) -> str:
    d = _d(s)
    return f"{d.day} {d.strftime('%b')}" if d else "an unknown date"


def _r(v) -> str:
    return "n/a" if v is None else f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.2f}R"


def _px(v) -> str:
    return "n/a" if v is None else f"₹{v:,.2f}"


def build_brief(feed: dict, expected_session: date | None = None, weekly: bool = False, now: datetime | None = None) -> dict:
    """The brief as data. `expected_session` is the newest finished NSE session; when the feed's data stops before it, the brief says so first."""
    through = feed.get("data_through")
    gate = feed.get("gate") or {}
    sigs = feed.get("signals") or []
    cost = feed.get("cost_round_trip_pct")
    stale_days = None
    if expected_session and _d(through) and _d(through) < expected_session:
        stale_days = (expected_session - _d(through)).days

    failing = [c for c in gate.get("checks", []) if not c.get("ok")]
    new = [e for e in sigs if e.get("first_seen") == through and e.get("status") in ("pending", "open")]
    live = [e for e in sigs if e.get("status") in ("pending", "open")]
    changes: list[str] = []
    for e in sigs:
        sym = e.get("sym")
        if e.get("closed_date") == through and e.get("status") == "closed":
            changes.append(f"{sym}: closed on {e.get('exit_reason', 'its rules')}, {_r(e.get('r_net'))} after costs")
        elif e.get("status") == "void" and e.get("closed_date") == through:
            changes.append(f"{sym}: skipped ({e.get('void_reason', 'the entry rule')})")
        elif e.get("status") == "open":
            if e.get("stop_raised_on") == through:
                changes.append(f"{sym}: stop raised from {_px(e.get('stop_before'))} to {_px(e.get('stop_now'))}")
            for ev in e.get("events") or []:
                if ev.get("date") == through and ev.get("kind") in ("t1", "t2", "T1", "T2"):
                    changes.append(f"{sym}: {str(ev['kind']).upper()} reached at {_px(ev.get('price'))}")
    rec = feed.get("record") or {}
    hold = ((feed.get("backtest") or {}).get("rules") or {}).get("holdout") or {}
    setups = []
    for e in new:
        fail = [CAVEATS[0], CAVEATS[1], CAVEATS[2].format(cost=cost if cost is not None else "?")]
        if e.get("risk_pct") is not None and e["risk_pct"] >= 8:
            fail.insert(0, f"The stop is {e['risk_pct']}% below the reference price: a wide stop makes a small position.")
        if not gate.get("on"):
            fail.insert(0, "The market gate is off, so the rules say not to file this.")
        setups.append({"sym": e.get("sym"), "name": e.get("name"), "setup": e.get("setup"), "reference": e.get("ref_price"), "stop": e.get("sl"),
                       "t1_plan": e.get("t1_plan"), "t2_plan": e.get("t2_plan"), "risk_pct": e.get("risk_pct"), "max_hold_sessions": e.get("max_hold"),
                       "why": e.get("why"), "could_fail": fail})
    book = [{"sym": e.get("sym"), "status": e.get("status"), "entry": e.get("entry"), "stop": e.get("stop_now") or e.get("sl"), "r_open": e.get("r_open")}
            for e in live if e.get("first_seen") != through]

    out = {"schema": "alpha-brief/1", "version": feed.get("version"), "generated": (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "data_through": through, "stale_sessions_behind": stale_days, "paper_only": True,
           "alerts": {"on": bool(feed.get("alertable")), "why": feed.get("alert_why")},
           "gate": {"on": bool(gate.get("on")), "passed": gate.get("passed"), "of": len(gate.get("checks", [])),
                    "failing": [{"rule": c.get("rule"), "value": c.get("value")} for c in failing]},
           "new_setups": setups, "book": book, "changes": changes,
           "record": {"closed": rec.get("closed", 0), "avg_r": rec.get("avg_r")}}
    if weekly:
        gh = (feed.get("gate_history") or [])[-5:]
        enough = (rec.get("closed") or 0) >= MIN_CLOSED
        out["weekly"] = {"gate_on_days": sum(1 for g in gh if g.get("on")), "of_days": len(gh),
                         "paper_closed": rec.get("closed", 0), "paper_avg_r": rec.get("avg_r"),
                         "backtest_holdout_avg_r": hold.get("expectancy_r"), "holdout_trades": hold.get("n"),
                         "compared": enough,
                         "note": ("Paper average against the backtest's holdout average." if enough
                                  else f"{rec.get('closed', 0)} of {MIN_CLOSED} closed paper trades: too few to compare with the backtest. No decay or survival is claimed.")}
    out["text"] = render(out)
    return out


def render(b: dict) -> str:
    L = [f"Alpha signal brief · data through {_day(b['data_through'])} · paper only, not advice"]
    if b.get("stale_sessions_behind"):
        L.append(f"⚠ The data stops {b['stale_sessions_behind']} day(s) before the last finished session. Treat everything below as old.")
    a = b["alerts"]
    if not a["on"]:
        L.append(f"Alerts are off. {a.get('why') or 'The engine has not met its own bar.'}")
    g = b["gate"]
    L.append("")
    L.append(f"Market gate: {'ON' if g['on'] else 'OFF'} ({g['passed']} of {g['of']} rules pass).")
    for f in g["failing"]:
        L.append(f"  not met: {f['rule']}" + (f" ({f['value']})" if f.get("value") else ""))
    L.append("")
    if b["new_setups"]:
        L.append(f"New paper setups ({len(b['new_setups'])}):")
        for s in b["new_setups"]:
            L.append(f"{s['sym']} · {s['setup']} · reference {_px(s['reference'])}, stop {_px(s['stop'])} ({s['risk_pct']}% below), T1 {_px(s['t1_plan'])}, T2 {_px(s['t2_plan'])}, exit by session {s['max_hold_sessions']}")
            if s.get("why"):
                L.append(f"  why it matched: {s['why']}")
            L.append("  WHY THIS COULD FAIL: " + " ".join(s["could_fail"]))
    else:
        L.append("New paper setups: none." + ("" if g["on"] else " The gate is off, so the rules file nothing."))
    if b["changes"]:
        L.append("")
        L.append("Changed in the paper book:")
        L += [f"  {c}" for c in b["changes"]]
    if b["book"]:
        L.append("")
        L.append(f"Open or waiting ({len(b['book'])}): " + ", ".join(f"{x['sym']} {x['status']}" + (f" {_r(x['r_open'])}" if x.get("r_open") is not None else "") for x in b["book"]))
    r = b["record"]
    L.append("")
    L.append(f"Paper record: {r['closed']} closed" + (f", average {_r(r['avg_r'])} after costs." if r["avg_r"] is not None else ". No average until a trade closes."))
    w = b.get("weekly")
    if w:
        L.append("")
        L.append(f"Week: the gate was on {w['gate_on_days']} of the last {w['of_days']} sessions. {w['note']}")
        if w["compared"]:
            L.append(f"  paper {_r(w['paper_avg_r'])} over {w['paper_closed']} trades; backtest holdout {_r(w['backtest_holdout_avg_r'])} over {w['holdout_trades']}.")
    L.append("")
    L.append("Waiting for your approval: nothing. This brief sends no order and connects no account.")
    text = "\n".join(L)
    return text if len(text) <= LIMIT else text[: LIMIT - 40].rsplit("\n", 1)[0] + "\n… (shortened; the full brief is on the site)"


def send(text: str, env=os.environ, post=None) -> str:
    tok, chat = env.get("TELEGRAM_BOT_TOKEN"), env.get("TELEGRAM_CHAT_ID")
    if env.get("BRIEF_SEND") != "1" or not tok or not chat:
        return "delivery off: set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID and BRIEF_SEND=1 to send"
    body = urllib.parse.urlencode({"chat_id": chat, "text": text, "disable_web_page_preview": "true"}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{tok}/sendMessage", data=body)
    resp = (post or (lambda r: urllib.request.urlopen(r, timeout=20).status))(req)
    if resp != 200:
        raise SystemExit(f"Telegram refused the message ({resp})")
    return "sent"


def main(argv: list[str]) -> int:
    if "--send" in argv:
        print(send(json.loads(OUT.read_text())["text"]))
        return 0
    import sessions as SESS
    feed = json.loads(FEED.read_text())
    b = build_brief(feed, SESS.last_finished_session(), weekly="--weekly" in argv)
    OUT.write_text(json.dumps(b, ensure_ascii=False, indent=1) + "\n")
    print(b["text"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
