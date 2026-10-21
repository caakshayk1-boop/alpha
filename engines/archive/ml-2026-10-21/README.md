# Retired: the five ML engines (21 Oct 2026)

Rank, Barrier, Relative, Snapback and Compounder ranked every screened stock every evening and the top ranks always became
signals. None cleared a significant holdout (best month-clustered t +1.42, the owner's alert bar is 2), so on 21 Oct 2026
they were replaced by Swing v2 (`engines/swing.py`), which trades only when the market gate is on.

`registry.json` is every signal they issued, as tracked at retirement; `engines.json` is their last published feed. Nothing
reads either. Their code (`ai_*.py`, `features.py`, `labels.py`, `walkfwd.py`) and research results stay in the repo for the
record and are not scheduled.
