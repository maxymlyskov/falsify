# Why falsify exists

**Make the agent prove the bug before it writes the fix.**

Your coding agent just fixed a bug that didn't exist.

It read the ticket, formed a theory, wrote a patch, added a test, and the test passed. The PR looks
excellent. The reported problem is still there — because the test was written against the agent's
theory, not against the symptom the reporter actually saw.

This repository describes a small set of gates that make that failure mode structurally impossible.
Not prompts. Not "think step by step." Gates: checks an agent has to *pass* before it is allowed to
proceed to the next step.

> **The core rule:** an agent may not open a branch until it has reproduced the reported symptom as a
> failing assertion whose actual value equals the value in the report. That equality is the proof.

---

## Why this exists

Most agentic coding advice optimizes for speed. Speed is not the bottleneck any more — it hasn't been
since agents got good at writing plausible code. The bottleneck is **plausibility**: an agent's wrong
answer looks exactly like its right answer, and both come with passing tests.

Three things follow from that, and they're the whole of this repo:

1. A diagnosis that hasn't been executed is a guess.
2. A test written after the theory tests the theory, not the bug.
3. "The tests pass" means nothing if the agent chose the tests.

These patterns were extracted from a command system used to run a production SaaS as its only
engineer — roughly 1,900 pull requests on a single codebase. They are written here generically, with
no reference to that system's stack or ticket format. Steal the parts that fit.

---

## The five verdicts

Before an agent touches a branch, it has to commit to exactly one verdict. This is the highest-value
gate in the set, because the default assumption in almost every bug report is wrong.

| Verdict | Meaning | What happens next |
|---|---|---|
| `CONFIRMED-BUG` | Evidence reproduces the defect **and** the code contradicts both the config and the documented behavior | Proceed to the probe |
| `WORKING-AS-DESIGNED` | The mechanism reproduces the reported value from the current config, correctly | Stop. Explain. No branch. |
| `CONFIG` | Real problem, wrong layer — a setting produces this, not the code | Stop. Name the setting. No branch. |
| `NOT-BUILT` | The capability was never built; the governing code path has no logic addressing it | Stop. "No setting exists" is not a defect. |
| `UNCONFIRMED` | Evidence is insufficient, or contradicts the reported cause | Stop and ask. **Never branch on this.** |

**The default hypothesis is `WORKING-AS-DESIGNED`.** The agent's job is to try to clear that bar, not
to assume a bug and go looking for it.

**A supplied root cause is a hypothesis to disprove, not a spec.** This matters more than it sounds.
When a ticket arrives already containing `file.ts:214 — the deposit calculation is wrong`, an agent
will happily go fix line 214. Sometimes line 214 is fine and the account's configured rate is
genuinely 0%. The most expensive bugs in an agentic workflow are the ones where a human's guess
became the agent's specification.

---

## The probe

Once the verdict is `CONFIRMED-BUG`, the agent still doesn't get a branch. First it writes a probe.

A probe is **one** test asserting the value the reporter expected. It must fail, and it must fail
**with the exact value the reporter reported**.

```
Reporter says:  "the total shows $0.00, should be $45.00"

Probe:          expect(total).to.equal(45.00)
Run it.

  FAIL: expected 45.00, got 0.00      ← the diagnosis is now executable. Proceed.
  FAIL: expected 45.00, got 38.50     ← you are looking at a different bug. Stop.
  PASS                                ← there is no bug here. Stop.
```

Only the first outcome is proof. The other two are the agent discovering, cheaply and before any code
is written, that it was about to fix the wrong thing.

The probe is not thrown away. It is the first RED test of the implementation that follows, and it is
never rewritten — rewriting it to pass is the exact failure this whole pattern exists to prevent.

### Why the value has to match

A test that fails is easy. A test that fails *the same way the user's system failed* is a
reproduction. The difference between those two is the difference between "I have a theory" and "I
have the bug in a vise."

---

## Evidence before hypothesis

The agent gathers evidence **before** it forms a theory, not to confirm one it already has.

- Pull identifiers out of every available source — the ticket body, comments, screenshots, error
  strings, the user's own words.
- Query the real systems in parallel: logs, database, the relevant third-party API. Read-only.
- Then, and only then, form a diagnosis.

One rule that repeatedly earns its keep: **check whether the feature was even enabled before
investigating why it misbehaved.** Evidence gathered on a disabled feature proves nothing, and an
agent will cheerfully spend an hour explaining the behavior of code that never ran.

---

## Scope decides depth, not ambition

Gates are not free — each one costs wall-clock time. So scope the battery to the change:

**`small`** when *all* of: three or fewer worklist items, no schema change, and no pre-existing test
lines being edited. Otherwise **`full`**.

Two things that feel like they should force `full` and shouldn't:

- **A migration in scope.** Migration risk is the migration gate's job. Re-running an unrelated
  400-test suite proves nothing about it.
- **Touching two repositories.** That's the cross-repo gate's job, for the same reason.

Getting this wrong is expensive in the most annoying way: we once spent eight minutes of wall clock
running a 428-test suite twice to cover a three-line guard, because "migration present" and "two
repos" each independently forced the deepest battery.

---

## Steering belongs in gates, not prose

The instinct when an agent misbehaves is to add a sentence to the prompt. Resist it.

Prose degrades. It gets skimmed, contradicted by a later paragraph, or diluted as the file grows.
A gate either passes or it doesn't.

| Instead of prose that says… | Write a gate that… |
|---|---|
| "Please make sure the bug is real" | refuses to branch without a `CONFIRMED-BUG` verdict |
| "Try to reuse existing test files" | rejects a new test path when a sibling exists in that directory |
| "Don't guess at the root cause" | requires the probe to fail with the reported value |
| "Be careful with database changes" | requires a rolled-back transaction proving up() and down() round-trip |

A useful test of any instruction you're about to add: *could this be checked by a script?* If yes,
make it one. If no, ask whether it will actually change behavior, or just make you feel better.

---

## Subagent scoping

When work is delegated to subagents, give each one a short, fresh prompt containing only what it
needs. Never the full ticket dump.

Context is not free and it is not neutral — a subagent handed the entire investigation inherits every
dead end and every discarded theory in it, and will helpfully act on them. The architect gets the
clarifications and the evidence. The implementer gets the worklist item and its proof. The reviewer
gets the diff and the acceptance criteria.

Dispatch independent subagents and independent gates concurrently. Never idle on one agent when other
work is ready to run.

---

## What this is not

- **Not only a plugin.** The contract is portable and implementation-agnostic; `falsify` is one
  implementation of it, for Claude Code.
- **Not a claim that agents are unreliable.** The opposite — they're reliable enough that the
  remaining failures are subtle, which is precisely why they need structural checks rather than
  vigilance.
- **Not measured.** These patterns come from one engineer on one production codebase. They are a
  hypothesis with a lot of practice behind it, not a study. See
  [open-questions.md](open-questions.md) — if you have data, I'd genuinely like it.

---

## Contents

| File | What's in it |
|---|---|
| [contract.md](../skills/task/references/contract.md) | The gates as a portable, implementation-agnostic checklist you can port into any harness |
| [worked-example.md](worked-example.md) | A full run, including the part where the diagnosis was wrong |
| [open-questions.md](open-questions.md) | What I don't know, and what would settle it |

## License

MIT — see [LICENSE](../LICENSE). Take the ideas, no attribution needed.
