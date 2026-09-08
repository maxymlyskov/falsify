# Gates — the battery

Every gate detects one named defect class, cannot pass while the property is false, has a bounded cost,
and prints one `<NAME>_RESULT {json}` line the orchestrator appends to the run record with a tier.
`pass:null` = could not measure (`code` says why) → the scorecard renders `[—]`, never PASS. Exit 0 on
`pass:true|null`, 1 on `pass:false`, 2 on `ok:false`. `<base>` is `git.base` from
`.claude/falsify.config.json`; every script diffs from `git merge-base <base> HEAD` and includes untracked
files. Commands below are written short as `<gate> …`; run them as `node "${CLAUDE_PLUGIN_ROOT}/bin/<gate>" …` (works from any shell tool; `bin/` is also on the Bash tool PATH while the plugin is enabled).

Tier rule (written by the orchestrator when it records a gate): `A` = this run executed the measurement;
`B` = inherited, asserted, or proxy (state the reason); `—` = structurally inapplicable with a stated
reason. A `pass:null` result is recorded as-is; the scorecard maps it to `—` with the code as the reason.

## Environment — a gate that could not run is never absorbed
`—` is for a gate that is **structurally inapplicable**: the diff holds no file of the kind it measures
(`NO_TARGETS`, `NO_FUNCTIONS`, no spec in the worklist). A gate whose *tool* is missing, unconfigured or
not running is a different thing, and it is never downgraded on the agent's own authority. Record the
result, then print one line per blocked gate

```
ENV_BLOCKED: <gate> — <the command that failed | the config key that is null> — costs <row> tier <B|—>
```

and ask the user ONE question, recommendation first: start it · configure it · proceed at the stated tier.
Wait for the answer; no further gate runs past that print. A "proceed" goes into `degraded[]` in the
user's own words and rides into the PR. Covers `NO_TYPESCRIPT` while a typed file is in the diff ·
`ui.screenshot` null, or exiting non-zero, on a frontend diff · a preview recipe that will not run ·
`db.url` null with a migration in the diff · `gates.clean.command` null · G6 `INCONCLUSIVE` ·
`TEST_DB_DOWN` and readiness timeouts (`recipes.md §testdb`) · any surface a QA agent reports down.
Missing environment is the one failure class that has to reach the user before the run continues: absorb
it quietly and "we could not check this" gets filed as "we checked this".

Every threshold below states its provenance. Sources in full: `why.md`.

## G0 · Diff size — hard
- Defect class: review blindness on large changes.
- Source: Rigby & Bird, ESEC/FSE 2013 (median change 25–78 lines, peer-reviewed); SmartBear/Cisco 2006
  (< 200 LOC, never > 400 — practitioner grade).
- Command: `diffsize <base> [--allow "<reason>"]` (thresholds from `gates.size`).
- Pass: changed non-test, non-migration, non-generated LOC ≤ halt (400). warn (200) → `warn:"LARGE"`.
  Over halt → `SPLIT_REQUIRED`: halt the run unless it carries `large-change "<why>"`, which becomes
  `--allow` and is printed in the scorecard's Size line.
- N/A: never. Tier: A.

## G1 · Types — hard
- Defect class: type errors, including fan-out into files the diff did not touch.
- Source: Gao, Bird & Barr, ICSE 2017 — 15% of public JS bugs detectable by TypeScript (CI 11.5–18.5%).
- Command: `typegate <base> [--roots <typecheck.roots>] [--tsc "<typecheck.command>"]`.
- Pass: branch error set ⊆ base error set, keyed `file:code:message`. `NEW_ERRORS` lists the additions —
  fix them; never argue from the base count. `NO_TYPESCRIPT` (no tsconfig) → `—`.
- Cost: two type-checks per root; the base side is cached per merge-base sha. Re-run only in repair
  rounds that touched a typed file. Tier: A.

## G2 · Fan-out
- Defect class: incomplete change propagation — the file you forgot.
- Source: Zimmermann, Weißgerber, Diehl & Zeller, ICSE 2004 / TSE 2005 (co-change mining: > 70% top-3
  hit rate); Chidamber & Kemerer 1994, Henry & Kafura 1981 (coupling as risk).
- Command: `fanout <base> [--dismiss <file>=<reason>]...` — static rules from `gates.fanout.rules`.
- Pass: no `MISSED?` (co-changed in ≥ conf of the changed file's last `window` commits, support ≥
  `support`, not in the diff, still exists) and no `STATIC` site. Every flagged file is edited or
  dismissed with a reason; reasons ride into the PR's `## Fan-out` section.
- Thresholds: `conf 0.5 · support 3 · window 30` — provenance `prior — unmeasured`, printed in the result.
- N/A: `NO_TARGETS` when no source file changed. Tier: A; B under budget degradation (static list only).

## G3 · Behaviors — hard
- Defect class: the change does not do what the ticket asks.
- Source: Fucci et al., TSE 2017 — cycle granularity and uniformity predict quality; test-first vs
  test-last order does not (Fucci et al., ESEM 2016, randomized). Nagappan et al., ESE 2008 — 40–90%
  lower pre-release defect density *reported* (observational).
- Command: `test.command` with `{grep}` = alternation of this task's `it()` names, `{db}` = the
  orchestrator's own database. Recipes: `recipes.md §testcmd`.
- Pass: passing count == the behavior count and 0 failing. `0 passing` is a failed gate (the grep
  matched nothing). Record `{pass, behaviors, passing, failing}`.
- N/A: `TDD: no` and no spec in the worklist → `—` with reason `no behavior test`. Tier: A.

## TAMPER · Test integrity — hard
- Defect class: tests weakened to make a gate pass.
- Source: ImpossibleBench (Zhong, Raghunathan & Carlini, 2025 — 76% cheating rate by test modification);
  METR 2025/2026; Zhang & Mesbah, ESEC/FSE 2015 (assertions predict effectiveness).
- Command: `tamper <base> [--accept <file>:<line>=<reason>]...`.
- Pass: no finding — removed `it(`/`describe(`, added `.skip`/`.only`/`xit`, removed `expect(`/`assert`,
  an empty `catch` around an assertion, a changed expected literal in a pre-existing assertion, a deleted
  test file. A legitimate rewrite is `--accept`ed with a reason that reaches the PR; never silently
  allowed. This gate loops; it does not halt.
- N/A: `pass:null` is a hard failure here — the scorecard treats it as NOT SHIPPABLE. Tier: A.

## G4 · Regression — hard
- Defect class: breaking pre-existing behavior.
- Source: Rothermel & Harrold, TOSEM 1997 (safe selection never omits a test that could expose the
  regression); Gligoric, Eloussi & Marinov, ISSTA 2015 (file dependencies suffice; 32% time saved).
- Command: `select-specs <base> [--depth <gates.regression.depth>] [--max <gates.regression.max>]` →
  run every selected spec whole (`test.command` without `{grep}`, one run per spec, own `{db}`).
  `specs:"ALL"` → run the whole suite, or when the budget forbids it record tier B with reason
  `selection exceeded max; CI runs the suite` and open the PR as a draft.
- Pass: every selected spec 0 failing. Record `{pass, specs, passing, failing, round}`.
- N/A: `NO_TARGETS`; `specs: []` → `—` with reason `no spec imports the changed files` (name them).
- Tier: A when the selected specs ran this round; B when CI stands in.

## G5 · Complexity
- Defect class: code the next reader cannot hold.
- Source: McCabe, TSE 1976 / NIST SP 500-235 (cyclomatic 10); Campbell, SonarSource — SonarQube S3776
  default (cognitive 15, **a tool default, not an empirical result**).
- Command: `complexity <base> [--cyclomatic <gates.complexity.cyclomatic>] [--cognitive <…>]`.
- Pass: no `OVER` — a new or grown function above either threshold. Simplify inline (guard clauses,
  collapse redundant branches, merge duplicated paths); never touch lines outside this branch's diff.
  `PREEXISTING` is report-only. The result names the `worst` touched function for the scorecard.
- N/A: `NO_TARGETS`, `NO_FUNCTIONS`. `NO_TYPESCRIPT` → §Environment (fix it, do not score around it). Tier: A.

## G6 · Mutation
- Defect class: tests that run the code but assert nothing about it.
- Source: Petrović & Ivanković, ICSE-SEIP 2018 (Google: diff-based, ≤ 1 mutant/line, arid lines,
  AOR/LCR/ROR/UOI/SBR); Petrović, Ivanković, Fraser & Just, ICSE 2021 (exposure → more tests; 70% of
  high-priority bugs coupled); Just et al., FSE 2014; Inozemtseva & Holmes, ICSE 2014 (why not coverage).
- Command: `mutants <base> "<the G3 command>" <gates.mutation.max> [--skip-baseline]
  [--fail-regex <test.failRegex>] [--equivalent <file>:<line>=<reason>]...` — the script resolves the
  app root itself and refuses (`SPEC_NOT_FOUND`) when the spec path does not exist there.
  `--skip-baseline` only when G3 just ran green on the identical command this round; the result records
  `baseline:"asserted-by-caller"`.
- Pass: `survivors: []`, `inconclusive: 0`, `timeouts: 0`. A survivor is an added line no test asserts:
  add the killing `it()` (public interface) and re-run G3 → G6, or mark it `--equivalent` with a one-line
  reason that reaches the PR's `## Mutation survivors`. `INCONCLUSIVE` = the runner exited non-zero
  without a failing test (crash, wrong cwd, type error) — §Environment: fix the run, never count it.
  **No kill-rate threshold** (ADR-0004). Scope `small` → sample `gates.mutation.small` (4); `full` → `max` (6).
- **Runs alone.** The only gate that writes to the working tree: the G4 runs and every QA agent must have
  returned before it starts, or their test run reads a mutated file and fails for a reason nobody can
  distinguish from a real one.
- N/A: `NO_TARGETS` (no mutable line added). Tier: A; B in the scorecard when `equivalent > tried/2`.

## G7 · Real-world — hard
- Defect class: the fix works in the test, not in the artefact.
- Source: Zeller, *Why Programs Fail* (reproduce first; predict → observe); Ambler & Sadalage 2006,
  Sato 2014 (expand → migrate → contract: the contract half is the risk).
- Command: frontend → `ui.screenshot` with `{route}` `{expect}` (recipes.md §screenshot), Read every
  screenshot. Migration → the rolled-back transaction block (recipes.md §migration), `up()` and `down()`,
  one seeded row per predicate branch. Backend-only, no migration → the deepest test run that ran
  (G4, else G3) stands as proxy.
- Pass: screenshot shows the expected state with 0 console errors / migration round-trips / proxy
  recorded. Tier: A for a screenshot or migration proof; B for the proxy
  (`result:null, tier:"B", reason:"G4 whole-spec run stands as proxy"`). `ui.screenshot` absent or failing
  and a frontend file changed → §Environment first; `B` with reason `no screenshot command configured` only
  once the user has said to proceed (setup can add one instead).

## G8 · Cleanliness
- Defect class: junk that taxes reviewers.
- Source: Bacchelli & Bird, ICSE 2013 (defects are 14% of review comments; the value is understanding).
- Command: `gates.clean.command` (a formatter/linter with `--fix`) on the branch diff. If it changed any
  file → re-run G1 + G3 + G5 in parallel. Record `{pass:true, fixes, findings}`.
- N/A: `gates.clean.command` null → §Environment, then `—` with reason `not configured`. Tier: A.

## QA · Adversarial QA — hard
- Defect class: defects the author's tests could not imagine.
- Source: self-preference bias (Panickssery, Bowman & Feng, NeurIPS 2024; Zheng et al., NeurIPS 2023);
  Bacchelli & Bird 2013; Rigby & Bird 2013 (two reviewers optimal); Luo et al., FSE 2014 (concurrency
  and order dependency = 32% of flaky tests → one database per agent).
- Command: one fresh `sonnet` agent per surface, `prompts/qa.md` filled per the placeholder table in
  `SKILL.md`, all surfaces in one message. Record `{steps, stepsA, edge, house, fired, blocking}` —
  `stepsA` = procedure steps with `[A]` evidence.
- Every test run a QA agent makes is grepped: `test.command` with `{grep}` filled from the `it()` names in
  the worklist proofs. No whole-file run, no whole-suite run — G4 already ran the whole specs that can
  regress, this round, so a QA rerun of them proves nothing and costs minutes.
- Pass: `blocking: 0` and no `ENV_BLOCKED` (§Environment). A `blocking` finding enters the repair loop;
  `out-of-scope` / `accepted` → `## Review Notes`. Three rounds without PASS → ask the user with the findings verbatim.
- Tier: the row's value is `stepsA / steps`.

## Probe · Diagnosis (bugs)
- Defect class: fixing the wrong cause.
- Source: Zeller — the experiment must predict the observed value; default hypothesis "working as
  configured" (ADR-0001).
- Rule: one `it()` on base in the spec owning the SUT, asserting the reporter's expected value; it must
  fail with `actual == the reported value`. Recorded as `probe: {spec, it, expected, actual}`; the
  scorecard prints it and tiers Diagnosis A. No probe → tier B (asserted).
