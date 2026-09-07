# ADR-0003 — The confidence verdict is computed from gate output, never typed

**Status:** accepted · 2026-09-07

## Context

The previous pipeline ended with a `## Confidence` block the model filled in and a line reading
`Verdict: HIGH`. LLM evaluators favour their own output (Panickssery, Bowman & Feng, NeurIPS 2024) and
show position and verbosity bias (Zheng et al., NeurIPS 2023). A self-assessed verdict is the least
trustworthy evidence in the run, placed at the most consequential point.

## Decision

`bin/scorecard` computes the block from the run record (every gate's `*_RESULT` line and its evidence tier):

1. **Hard gates are conjunctive.** Types, behaviors + tamper, regression (when triggered), real-world (when
   triggered), size, QA-no-blocking. Any failure → score 0, `NOT SHIPPABLE`. Defects do not average.
2. **Evidence score** over the remaining rows: `100 × Σ(w · t · pass) / Σ(w over applicable rows)`, where
   tier `t` is 1.0 for `[A]` (executed this run), 0.5 for `[B]` (inherited or proxied), and `[—]` rows are
   excluded. Weights are declared in `scorecard.weights.json` with `provenance: "prior — unmeasured"`.
3. **Override:** the row for the dimension the ticket is about must be `[A]`, else the verdict caps at MEDIUM.

`HIGH ≥ 90` opens a PR. `MEDIUM 75–89` opens a draft and waits for CI. Lower loops back to the battery.

## Consequences

- The score measures one construct: how much of the claimed confidence was executed this run. It does
  not claim to measure correctness, and the README says so.
- Weights can be fitted once outcome tracking exists (out of scope for v0.1; the run record keeps the data).
- Two `[B]` rows on important dimensions (e.g. Regression 15 + Fan-out 10 at 0.5) score 87.5 → MEDIUM.
  That is the intended behaviour: inherited evidence on two axes is where PRs go wrong.

## Evidence

Kaner & Bond, "Software Engineering Metrics: What Do They Measure and How Do We Know?", METRICS 2004 —
construct validity. Dijkstra (1970): testing shows the presence of bugs, never their absence; a green
battery is "no detector fired".
