"""Signal brief tests (no network, nothing sent). Run: python tests/test_brief.py"""
import copy, json, pathlib, sys
from datetime import date
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import brief as B

ok = fail = 0
def check(name, cond, detail=""):
    global ok, fail
    print(("  PASS  " if cond else "  FAIL  ") + name + ("" if cond else f"  {detail}"))
    ok, fail = ok + bool(cond), fail + (not cond)

feed = json.loads((pathlib.Path(__file__).resolve().parent.parent.parent / "public" / "signals.json").read_text())
through = feed["data_through"]
real = B.build_brief(feed, date.fromisoformat(through))
check("the live feed builds a brief with the feed's own date and version", real["data_through"] == through and real["schema"] == "alpha-brief/1")
check("it states alerts are off with the engine's own reason while the engine is not alertable", feed["alertable"] or ("Alerts are off." in real["text"] and feed["alert_why"] in real["text"]))
check("a gate that is off says so and names every unmet rule", feed["gate"]["on"] or (("Market gate: OFF" in real["text"]) and real["text"].count("not met:") == sum(1 for c in feed["gate"]["checks"] if not c["ok"])))
check("with no setups it says none, never an invented one", feed["signals"] or "New paper setups: none." in real["text"])
check("it never asks anyone to buy or sell", all(w not in real["text"].lower() for w in ("buy ", "sell ", "must", "guarantee")))
check("it ends by saying nothing awaits approval and no order is sent", "sends no order" in real["text"])
check("fits one Telegram message", len(real["text"]) <= 4096)
check("a brief with no Sunday flag has no weekly block", "weekly" not in real)

stale = B.build_brief(feed, date.fromisoformat(through).replace(day=min(28, int(through[-2:]) + 3)))
check("data older than the last finished session is flagged first", stale["stale_sessions_behind"] and stale["text"].splitlines()[1].startswith("⚠"))

f = copy.deepcopy(feed)
f["gate"]["on"] = True
f["signals"] = [
    {"id": "a", "sym": "AAA", "name": "Aaa", "setup": "Pullback", "first_seen": through, "status": "pending", "ref_price": 100, "sl": 90, "risk_pct": 10.0, "t1_plan": 120, "t2_plan": 140, "max_hold": 30, "why": "RSI 44 and a close above the 20-day", "events": []},
    {"id": "b", "sym": "BBB", "status": "closed", "closed_date": through, "exit_reason": "stop", "r_net": -1.1, "first_seen": "2026-09-01", "events": []},
    {"id": "c", "sym": "CCC", "status": "open", "first_seen": "2026-09-20", "stop_raised_on": through, "stop_before": 90, "stop_now": 101.5, "r_open": 1.2, "events": [{"date": through, "kind": "t1", "price": 120}]},
]
s = B.build_brief(f, date.fromisoformat(through))
t = s["text"]
check("a new setup carries reference, stop, both targets and the hold limit", all(x in t for x in ("AAA", "₹100.00", "₹90.00", "₹120.00", "₹140.00", "session 30")))
check("every setup has a WHY THIS COULD FAIL section", t.count("WHY THIS COULD FAIL") == 1 and s["new_setups"][0]["could_fail"])
check("a wide stop is called out as a risk", any("wide stop" in x for x in s["new_setups"][0]["could_fail"]))
check("a closed trade, a raised stop and a target hit are reported as changes", len(s["changes"]) == 3 and "closed on stop" in t and "stop raised" in t and "T1 reached" in t)
check("only setups first seen today are 'new'; the rest are the book", [x["sym"] for x in s["new_setups"]] == ["AAA"] and [x["sym"] for x in s["book"]] == ["CCC"])
f2 = copy.deepcopy(f); f2["gate"]["on"] = False
check("a setup filed while the gate is off is flagged against the rules", "gate is off, so the rules say not to file this" in B.build_brief(f2, date.fromisoformat(through))["text"])

w = B.build_brief(feed, date.fromisoformat(through), weekly=True)
check("the weekly block declines to compare below the closed-trade floor", w["weekly"]["compared"] is False and "too few" in w["text"] and "No decay or survival is claimed" in w["text"])
f3 = copy.deepcopy(feed); f3["record"] = {"closed": 31, "wins": 15, "total_r": 4.0, "avg_r": 0.13}
w3 = B.build_brief(f3, date.fromisoformat(through), weekly=True)
check("at the floor it compares paper with the backtest holdout", w3["weekly"]["compared"] and "backtest holdout" in w3["text"])

big = copy.deepcopy(f); big["signals"] = [dict(f["signals"][0], id=str(i), sym=f"S{i}") for i in range(60)]
check("a long brief is shortened to one message, not dropped", len(B.build_brief(big, date.fromisoformat(through))["text"]) <= 4096)

calls = []
check("no secrets: delivery is off and nothing is posted", B.send("x", env={}, post=lambda r: calls.append(r)).startswith("delivery off") and not calls)
check("secrets without BRIEF_SEND=1 still send nothing", B.send("x", env={"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "c"}, post=lambda r: calls.append(r)).startswith("delivery off") and not calls)
check("all three present: one post to Telegram's sendMessage", B.send("x", env={"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "c", "BRIEF_SEND": "1"}, post=lambda r: (calls.append(r), 200)[1]) == "sent" and len(calls) == 1 and "/sendMessage" in calls[0].full_url)

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
