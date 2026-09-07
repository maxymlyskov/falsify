# ADR-0006 — Angular commit convention; the history is documentation

**Status:** accepted · 2026-09-07

## Context

A repo about proving things should be able to prove how it was built. A single "initial commit" hides
that; a history of `wip` and `fix stuff` hides it worse. A reader should be able to run `git log
--grep="fix(mutants)"` and see every way the mutation gate could once be fooled and what closed it.

## Decision

Angular convention, enforced by `.githooks/commit-msg` locally and by CI over the PR range:
`<type>(<scope>): <subject>`, types `build ci chore docs feat fix perf refactor revert style test`,
subject ≤ 72 chars, body ≤ 100 per line and states the *why* — the finding, the source, or the measured
number. A script change and its failing-then-passing test are one commit. No squash-merge.

Commits carry a `Co-Authored-By` trailer for the agent that wrote them. The repo is about agentic
pipelines with gates; hiding the agent would contradict the thesis.

## Consequences

- `CHANGELOG.md` is generated from changesets; commit types make release notes mechanical.
- `git log --oneline -- bin/mutants` reads as the gate's biography.
- Contributors get a rejected commit with the rule quoted, not a review comment a day later.

## Evidence

Angular commit message guidelines (angular/angular CONTRIBUTING.md); Conventional Commits 1.0 is the
generalisation and is compatible.
