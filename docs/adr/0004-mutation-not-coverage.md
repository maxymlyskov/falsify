# ADR-0004 — Mutation testing, diff-scoped and review-shaped; no coverage gate

**Status:** accepted · 2026-09-07

## Context

Coverage says a line ran. It does not say a test would notice if the line changed. Inozemtseva & Holmes
(ICSE 2014) found low-to-moderate correlation between coverage and suite effectiveness once suite size is
controlled; Just et al. (FSE 2014, 357 real faults) found mutant detection correlates with real-fault
detection independently of coverage, with 73% of real faults coupled to mutants. Coverage percentages are
also the most gameable number in software.

## Decision

`bin/mutants` follows Google's production shape (Petrović & Ivanković, ICSE-SEIP 2018; Petrović, Ivanković,
Fraser & Just, ICSE 2021): diff-scoped, at most one mutant per added line, operators AOR/LCR/ROR/UOI/SBR,
arid lines (logging, metrics, imports) suppressed, a bounded sample spread across files. There is **no
kill-rate threshold**: every surviving mutant is a review item — killed by a new test or marked
`equivalent` with a one-line reason recorded in the PR. A kill requires a failing assertion in the test
output, not merely a non-zero exit. Zero candidates is `pass: null` (not measured), never PASS.

No coverage gate exists in the battery.

## Consequences

- The scorecard's Mutation row reads `killed k of tried t (candidates c)`, never a percentage.
- `equivalent` marks beyond half the tried mutants drop the row to tier `[B]`.
- A `tried: 0` result on a non-trivial diff is a signal to widen operators, not a pass.

## Evidence

DeMillo, Lipton & Sayward, IEEE Computer 1978 (mutation analysis, coupling effect); the four papers above;
Zhang & Mesbah, ESEC/FSE 2015 (assertions, not coverage, predict effectiveness) — also the basis of the
tamper gate's "removed expect" rule.
