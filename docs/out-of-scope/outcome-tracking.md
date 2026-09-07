# Deferred — outcome tracking (does HIGH predict anything?)

Not in v0.1, by decision on 2026-09-07. The scorecard measures how much of the claimed confidence was
executed this run; whether a HIGH verdict predicts fewer reverts, hotfixes or reopened tickets than a
MEDIUM one is an empirical question this repo cannot answer yet.

What v0.1 does keep: the run record (every gate result, tier, round, cost) so that when outcomes are
recorded — change failure rate per Forsgren, Humble & Kim, *Accelerate* (2018) — the weights in
`scorecard.weights.json` can be fitted instead of guessed. `docs/open-questions.md` lists the specific
questions and the confounders.

Would reopen as: v0.2 — a `burden outcome <pr> <revert|hotfix|reopen|clean>` record, a per-quarter
calibration table (verdict × outcome), and weights re-fitted with provenance changed from
`prior — unmeasured` to `fitted: <n> runs, <date>`.
