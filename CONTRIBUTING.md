# Contributing

## Commits — Angular convention, enforced

Every commit is checked by `.githooks/commit-msg` locally (`npm run prepare` installs it) and by CI over
the whole PR range. The rules are the Angular ones:

```
<type>(<scope>): <subject>

<body — why, not what; wrap at 100>

<footer — BREAKING CHANGE: …, Closes #n, Refs ADR-000n>
```

| type | use for |
|---|---|
| `feat` | a new gate, skill, or capability |
| `fix` | a gate that could pass while wrong, a script defect |
| `test` | fixtures and cases only |
| `docs` | README, ADRs, references, incident ledger |
| `refactor` | no behaviour change — a gate's output must be byte-identical before and after |
| `perf` | measured speed-up; the body states the before/after numbers |
| `build` | manifest, package.json, hooks |
| `ci` | workflows |
| `chore` | everything else that is not source or docs |
| `style`, `revert` | as in Angular |

Scopes are directory-shaped: `gates`, `mutants`, `complexity`, `fanout`, `select-specs`, `typegate`,
`tamper`, `diffsize`, `scorecard`, `task`, `setup`, `prompts`, `references`, `adr`, `ci`.

Subject: imperative, lower-case, no trailing period, ≤ 72 chars. Body: the *why* — the finding, the
source (author, venue, year), or the measured number that motivated the change. A `fix(<gate>)` commit
body names the input that used to pass wrongly and now fails.

Every commit that changes a script ships with the test that fails before and passes after, in the same
commit. A commit that cannot be described in one type is two commits.

## Pull requests

Small. One concern. CI green (`node --test`, skill lint, plugin validation, commit lint). Squash-merge is
off: the commit history *is* the documentation of how the gates were built and why.

## Decisions

Anything a stranger would question goes in `docs/adr/` before the code that implements it. Anything we
decided *not* to build goes in `docs/out-of-scope/` with the reason.
