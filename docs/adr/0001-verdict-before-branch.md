# ADR-0001 — No branch exists before a verdict, and no verdict without evidence

**Status:** accepted · 2026-09-07

## Context

Bug reports arrive with a symptom, and often with a root cause and a culprit written by someone who has
more context than the agent and is still guessing. An agent handed `file.ts:214 is wrong` will fix line
214. In incident 4508 the supplied fix targeted a 0%-deposit configuration that was working exactly as
designed; the "fix" would have broken every account that set 0 deliberately.

## Decision

For `KIND: bug`, the pipeline gathers read-only evidence first (logs, data, documented intent, the code
at the cited line) and commits to exactly one verdict — `CONFIRMED-BUG`, `WORKING-AS-DESIGNED`, `CONFIG`,
`NOT-BUILT`, `UNCONFIRMED` — before any branch is created. The default hypothesis is working-as-configured;
a supplied root cause is a hypothesis to disprove. `UNCONFIRMED` never branches.

A `CONFIRMED-BUG` is then made executable by a **probe**: one failing test whose actual value equals the
reported value. Fails differently or passes → `ASSUMPTION_UNPROVEN`, no branch.

## Consequences

- Roughly one in six bug reports resolves to a non-bug verdict (unmeasured estimate; see
  `docs/open-questions.md` §1). Those produce an explanation, not a PR.
- The probe is the first RED test of the implementation and is never rewritten.
- The probe proves reproduction, not defect; the verdict proves defect. Both are required
  (`docs/worked-example.md`).

## Evidence

Zeller, *Why Programs Fail* (2005): reproduce first; hypothesis → prediction → experiment → observation.
The probe is the experiment; its predicted value is the reported one.
