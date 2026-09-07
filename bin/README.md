# Gate scripts

CommonJS, Node ≥ 18, no runtime dependencies (`typescript` is resolved from the repository under
test, falling back to the plugin's own copy). Every script prints exactly one `<NAME>_RESULT {json}`
line last and exits **0** on `pass: true | null`, **1** on `pass: false`, **2** on `ok: false`.
`pass: null` means "could not measure" and carries a `code`; the scorecard renders it `[—]`, never PASS.

Every gate diffs against `git merge-base <ref> HEAD` — not the tip of `<ref>` — and sees untracked
files as fully added. Thresholds carry their provenance in the result.

| Script | Gate | Result fields | Fails with |
|---|---|---|---|
| `diffsize <base> [--allow "<why>"]` | G0 size | `total, added, deleted, files[], warn, allowed, thresholds` | `SPLIT_REQUIRED` > 400 LOC |
| `typegate <base> [--roots a,b] [--tsc "<cmd>"]` | G1 types | `baseCount, branchCount, fixed, new[]` | `NEW_ERRORS` when branch errors ⊄ base errors |
| `fanout <base> [--dismiss f=why] [--rules p]` | G2 fan-out | `missed[], static[], dismissed[], thresholds` | `MISSED` |
| `select-specs <base> [--depth 2] [--max 12]` | G4 regression | `specs[{spec, via}]` or `specs: "ALL"` | — (selection only) |
| `complexity <base> [--cyclomatic 10] [--cognitive 15]` | G5 complexity | `checked, worst, over[], preexisting[], thresholds` | `OVER` |
| `mutants <base> "<test cmd>" [max] [flags]` | G6 mutation | `candidates, tried, killed, survivors[], equivalent[], inconclusive, timeouts, cwd, baseline` | `SURVIVORS`, `INCONCLUSIVE`, `TIMEOUTS`; `SPEC_NOT_FOUND`, `BASELINE_RED` (exit 2) |
| `tamper <base> [--accept f:l=why]` | hard | `findings[{file, line, kind, text}], accepted[]` | `TEST_TAMPERED` |
| `scorecard <run-record.json>` | verdict | `score, verdict, hardFailed[], capped, rows, cost` — prints `## Confidence` first | exit 1 below MEDIUM |

Weights and hard-gate list: `scorecard.weights.json` (each weight is a declared prior; see ADR-0003).

Tests: `npm test` — one `test/<gate>.test.js` per script, each on a temp git repo from
`test/helpers.js`. Journals and run records live under `.claude/.cache/` in the repository under test
(gitignored there).
