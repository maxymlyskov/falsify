# What can fool a gate

On 2026-09-07 two fresh reviewers with no context were given the source system's orchestrator, its four
subagent prompts and its two gate scripts, and asked to find where the procedure could pass while wrong.
They found fourteen logic weak points and six portability blockers. This page lists the ones that changed
the gates; the diagram that pinned them to the flow will be added as an SVG export.

| # | Where | How it could be fooled | What closed it |
|---|---|---|---|
| 8 | Regression | Trigger was "the spec was edited". A service change that broke three pre-existing tests in an append-only spec ran no whole-file test and shipped as `Regression [B]` → HIGH. | `select-specs`: every spec whose import closure reaches a changed file runs whole (Rothermel & Harrold 1997; Ekstazi 2015). |
| 9 | Mutation | From the repo root the spec path in the test command did not resolve; mocha exited non-zero on every mutant; 4/4 "killed". From the app root the path filter matched nothing; `tried: 0` was a pass. | `mutants`: a kill needs a failing-test line in the output; `SPEC_NOT_FOUND` refuses the wrong cwd; `tried: 0` is `pass: null`, never PASS. |
| 10 | Types | "No errors in changed files." A DTO type change that erred in the unchanged consumer passed. | `typegate`: branch error set ⊆ base error set, keyed by file, code and message. |
| 12a | Mutation journal | Restored unconditionally at startup: a killed run, a branch switch, and the next run overwrote the file with the other branch's source. | Journal carries the hash of the mutated content; restore only on match, else `JOURNAL_STALE`. |
| 12b | Mutation | Binary operators only; a new `if (!flag) return` had no candidate and passed; only the first 4 candidates in file order were tried and reported as "4/4". | AOR/LCR/ROR/UOI/SBR, ≤ 1 per line, round-robin across files, `killed k of tried t (candidates c)`. |
| 12c | Complexity | Every anonymous function keyed `<anonymous>`; a new complexity-10 callback in fn B inherited PREEXISTING from an older callback in fn A. | `complexity`: `<enclosing>#<ordinal>` keys; class-property arrows by name. |
| 12d | Mutation | No timeout: a mutated loop guard hung the run. | 2× baseline (min 60 s) or `--timeout`; a timeout is its own counter, not a kill. |
| 11 | All diff gates | Untracked new files were invisible — staging happened after the battery. | `lib/git`: untracked files are fully-added candidates. |
| 4 | All diff gates | Diffing against the tip of the base: a `fetch` that moved the base made foreign commits look like this branch's changes. | `lib/git`: merge-base. |
| 13 | Verdict | `Verdict: HIGH` typed by the model; `[B]` never blocked. | `scorecard`: conjunctive hard gates, tiered evidence score, ticket-dimension cap (ADR-0003). |
| — | Tests | Nothing stopped a deleted `it(` or an added `.skip`. | `tamper`: hard gate; a legitimate rewrite is `--accept`ed with a reason (ImpossibleBench 2025). |
| — | Fan-out | A prose command whose completeness the model judged for itself. | `fanout`: co-change mining from git history plus configurable static rules. |

Not closed here, by design: outcome tracking (does HIGH predict anything?) — `docs/out-of-scope/`.
