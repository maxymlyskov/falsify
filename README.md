# burden

Ticket in, proven PR out. A Claude Code plugin that refuses to branch on an unproven diagnosis and refuses
to open a PR below a confidence score it computed — not one the model typed.

Built running a production SaaS solo for four years with an agentic pipeline; every rule in here was paid
for by a specific bug, and the [incident ledger](skills/task/references/incidents.md) is public.

## What a run leaves behind

```
## Confidence
Diagnosis     CONFIRMED-BUG — probe deposit.spec.ts "charges $50 for a 2-lane package" expected 50 got 0 [A]
Behaviors     1 RED→GREEN                                                                    [A]
Regression    select-specs: 2 specs, 489 passing, 0 failing                                  [A]
Fan-out       1 flagged (deposit.mapper.ts, conf 0.8) — edited in round 2                    [A]
Complexity    worst calculateDeposit cyclomatic 7 / 10 · cognitive 9 / 15                    [A]
Mutation      killed 3 of 3 tried (candidates 3) · survivors 0 · equivalent 0                [A]
Real-world    G4 whole owning spec ran                                                       [A]
Cleanliness   0 fixes                                                                        [A]
QA            5/5 procedure steps [A] · 3 edge cases · 6 house checks (0 fired) · blocking 0 [A]
Size          14 LOC · Tamper clean · Types base 0 → branch 0
Score 100 / 100 · Verdict HIGH · rounds 2 · wall 9m41s · weights: prior — unmeasured
```

That block is printed by `scorecard` from the gates' JSON output; the model cannot edit it. `[A]` means
this run executed the measurement, `[B]` means it was inherited or proxied — and two `[B]` rows on
important dimensions drop the verdict to MEDIUM, which opens a draft PR and waits for CI instead.
(The block above is the scorecard's test fixture; a real run's block replaces it at v0.1.0.)

## Install

```
/plugin marketplace add maxymlyskov/burden
/plugin install burden
```

Then, once per repository:

```
/burden:setup
```

It asks where your tickets live (GitHub Issues, Linear, Jira, local files), what your test command is and
how it reports a pass, your base branch, whether there is a UI it can screenshot and how, and where the
handoff goes — and verifies each answer by running it before writing `.claude/burden.config.json`.

## How a run goes

1. **Intake** — fetch the ticket, check out the base branch, classify kind and lane; one question only if
   the classification is ambiguous.
2. **Investigate** — for a bug: gather read-only evidence and reach a verdict. The default hypothesis is
   *working as configured*; a root cause supplied in the ticket is a hypothesis to disprove, not a spec.
   For a feature: map the flow and check whether it already exists behind a setting.
3. **Probe** — a confirmed bug gets one failing test whose actual value equals the reported symptom. That
   equality is the proof. No branch exists before it.
4. **Grill** — at most two design questions, asked after reading the code, recommendation first.
5. **Design gate** — the worklist: one file-sized change per item, each with the test that proves it.
6. **Build** — coders get their slice and nothing else, one behavior per test cycle, each on its own test
   database.
7. **Gate battery** — nine gates, below. A failure is never a stop; it is a repair round.
8. **QA** — a fresh agent that did not write the code, handed the reasoning behind every design call so it
   can attack the reasoning instead of rediscovering it.
9. **Score** — computed. HIGH opens a PR; MEDIUM opens a draft and waits for CI; anything else goes back
   to the battery.

Full flow: [`skills/task/SKILL.md`](skills/task/SKILL.md). Portable checklist for any harness:
[`references/contract.md`](skills/task/references/contract.md).

## Why this shape

**Why a verdict before a branch.** The most expensive bug is the one you fix that wasn't there. A supplied
`file:line` root cause turned out to be a 0% configuration working exactly as designed
([incident](skills/task/references/incidents.md), [worked example](docs/worked-example.md)). The loop is
Zeller's scientific debugging (*Why Programs Fail*, 2005): hypothesis, prediction, experiment,
observation — the probe is the experiment.

**Why a fresh QA agent.** LLM evaluators favour their own output (Panickssery, Bowman & Feng, NeurIPS 2024)
and show position and verbosity bias (Zheng et al., NeurIPS 2023). The author is the worst-placed grader
of its own work; a second reader finds different things (Bacchelli & Bird, ICSE 2013).

**Why gates, not prose.** Coding agents under test pressure edit the tests: on tasks whose tests
contradict the spec, GPT-5 "passes" 76% by modifying tests or overloading operators (ImpossibleBench,
Zhong, Raghunathan & Carlini, 2025); METR reports that checking for cheating is often the majority of the
evaluation work (2026). A rule in prose is a suggestion. A script that fails the build is a gate.

**Why the score is computed.** A composite number is meaningful only when you can say what it measures and
how you know (Kaner & Bond, METRICS 2004). This one measures one thing: how much of the claimed confidence
was *executed* this run. Hard gates are conjunctive — one failure and the score is 0, because defects do
not average. The weights are declared priors marked `unmeasured`, to be fitted when outcomes are tracked.
It does not claim to measure correctness.

## The gates

| Gate | Catches | Evidence | Rule |
|---|---|---|---|
| Size | review blindness on large diffs | Rigby & Bird 2013: converged median change 25–78 lines; SmartBear/Cisco 2006 (practitioner): never > 400 LOC | > 400 changed LOC halts; opt out with a written reason |
| Types | type errors, including in files you didn't touch | Gao, Bird & Barr, ICSE 2017: 15% of public JS bugs detectable by TypeScript | error set on branch ⊆ error set on base |
| Fan-out | the file you forgot | Zimmermann et al., ICSE 2004: co-change mining predicts > 70% of "also change" sites in top-3 | files co-changed ≥ 50% with a changed file and not in the diff → edit or dismiss with a reason |
| Behaviors | the fix doesn't do what the ticket says | Fucci et al., TSE 2017: small, uniform TDD cycles drive quality; order alone does not | one `it()` per behavior, RED → GREEN, zero failures |
| Tamper | tests weakened to pass | ImpossibleBench 2025; Zhang & Mesbah 2015: assertions, not coverage, predict effectiveness | removed `it`, added `.skip`, removed `expect` → hard fail |
| Regression | broken existing behavior | Rothermel & Harrold 1997 (safe selection); Ekstazi, ISSTA 2015 | run every spec whose import closure includes a changed file |
| Complexity | code the next reader can't hold | McCabe 1976 / NIST 500-235: 10; SonarQube default: 15 cognitive | cyclomatic > 10 or cognitive > 15 on a new or grown function |
| Mutation | tests that run the code but assert nothing | Just et al., FSE 2014: mutants track real faults, coverage does not (Inozemtseva & Holmes 2014); Google, ICSE 2018 / 2021 | diff-scoped, ≤ 1 mutant per line; every survivor is killed or marked equivalent with a reason |
| Real-world | it works in the test, not in the app | Zeller: reproduce first; Ambler & Sadalage 2006: expand–contract | screenshot / rolled-back migration proof / deepest test run |

Every threshold carries its provenance in [`gates.md`](skills/task/references/gates.md); the ones that are
tool defaults say so. Sources with DOIs: [`why.md`](skills/task/references/why.md). Each gate is a
zero-dependency Node script in [`bin/`](bin/README.md) with a fixture-repo test that failed before the
gate was fixed and passes after.

## What can fool a gate

Three of the original eight gates passed vacuously — the regression gate keyed on spec edits, the mutation
gate counted crashes as kills, the type gate ignored errors in unchanged files — and the verdict was typed
by the model. The review that found them is the reason the gates look the way they do; it lives in the
[incident ledger](skills/task/references/incidents.md) and the
[weak-points diagram](docs/what-can-fool-a-gate.md). A gate you don't know how to fool is a gate you
don't understand.

## Not in scope

[`docs/out-of-scope/`](docs/out-of-scope/): a coverage-percentage gate, an LLM quality score, outcome
tracking (v0.2 — does HIGH predict fewer reverts? the run record keeps the data), other agent CLIs.

## Repository

- [`docs/thesis.md`](docs/thesis.md) — why this exists. [`docs/adr/`](docs/adr/) — the decisions a
  stranger will question, with their evidence. [`docs/open-questions.md`](docs/open-questions.md) — what is
  not measured yet.
- [`STYLE.md`](STYLE.md) — how every skill file is written; [`CONTRIBUTING.md`](CONTRIBUTING.md) — Angular
  commits, enforced; the history is documentation ([ADR-0006](docs/adr/0006-history-as-documentation.md)):
  `git log --oneline -- bin/mutants` reads as that gate's biography.

MIT.
