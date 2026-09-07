# Incident ledger

One entry per incident from the system this pipeline was extracted from (a production reservations
SaaS, one engineer, ~2,000 PRs). What escaped, the rule it earned, the check that now catches it. An entry
is never deleted; when a check changes, update `Check:`. A rule with no incident and no check is a
deletion candidate — this file is the pruning mechanism.

Tickets are anonymized; dates are real.

## 2026-07 · a supplied `file:line` fix was a 0% configuration working as designed
Rule: a pre-supplied root cause is a hypothesis to disprove, not a spec; default hypothesis is
working-as-configured, cleared only by docs × code × data.
Check: step 2 verdict (`recipes.md §evidence`) + step 3 probe equality — no branch on a non-CONFIRMED-BUG
verdict. ADR-0001. Full narrative: `docs/worked-example.md`.

## 2026-08 · a new enum member shipped without its DDL migration; every test was green
Rule: a type-level enum member backing a database enum column needs its own `ALTER TYPE … ADD VALUE`
migration; a green test run never proves it when the test schema is synchronized from the entities.
Check: G2 `fanout` static rule (configure in `gates.fanout.rules`); G7 migration block proves
`SELECT '<v>'::<type>` fails before and succeeds after (`recipes.md §migration`).

## 2026-08 · whole-file spec runs for a 3-line guard (8 wall-clock minutes)
Rule: scope is computed from the diff, never self-assigned; a migration or a second repo does not force
`full`; whole-file runs happen at G4 only, on the specs `select-specs` picks.
Check: step 7 scope computation + G4 `select-specs`.

## 2026-08 · a subagent hand-seeded 822 migration-table rows to make `migration:run` work on the test DB
Rule: the ORM's migration runner is never pointed at a synchronized test schema; the rolled-back
transaction block is the only sanctioned proof.
Check: G7 migration block (`recipes.md §migration`).

## 2026-08 · a 12-line migration cost ~15 minutes as a subagent
Rule: one file, under ~20 lines, no investigation → write it yourself (never applies to TDD items — the
RED→GREEN discipline is the point).
Check: step 6 delegation floor (`recipes.md §delegation`).

## 2026-08 · `down()` re-enabled a setting on rows created after the migration
Rule: a data migration proves `down()` as well as `up()`, one seeded row per predicate branch — contract
is the risky half of expand–contract.
Check: G7 migration block (`recipes.md §migration`).

## 2026-08 · QA flagged a deliberate `down()` choice as an unexplained gap; only the second round, given
the rationale, found the real defect inside that choice
Rule: give QA the reasoning, not just the claim. Withholding the "why" does not make QA more independent;
it makes it re-derive the decision before it can attack it.
Check: `{{DECISIONS}}` in `prompts/qa.md` — every design call the diff alone does not explain, each with
what would falsify it.

## 2026-09-02 · a stalled subagent committed a guard call inside a method no spec can reach
Rule: the diff that ships gets one full sweep after any repair round; types, behaviors and complexity all
pass an unreachable line — only the sweep (G6 survivor, G8 diff read) sees it.
Check: step 7 final full sweep; G6 survivor review; G8.

## 2026-09-02 · the query that would have made Real-world `[A]` was filed under remediation instead
Rule: a row that reads `[B]` on the dimension the ticket is about is upgraded before the PR — the evidence
is usually already in hand; until then the verdict is capped at MEDIUM.
Check: `scorecard` ticketDimension override (`scorecard.md`).

## 2026-09-07 · review of the pipeline itself: three of eight gates passed vacuously
Findings: the regression gate keyed on spec edits (a SUT change that broke old tests shipped as `[B]`);
the mutation gate reported 4/4 killed from a cwd where the spec path did not resolve (every crash counted
as a kill), and `tried:0` as a pass; the type gate ignored errors the diff caused in unchanged files; the
verdict was typed by the model.
Rule: a gate must fail when the property is false, and the verdict is computed. Check: `select-specs`
(G4), `mutants` kill grammar + `SPEC_NOT_FOUND` + `NO_TARGETS`, `typegate` base comparison, `scorecard`;
each with the test that failed before the fix. ADR-0002, ADR-0003. Full review: `docs/what-can-fool-a-gate.md`.
