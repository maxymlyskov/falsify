# Changelog

## 0.1.0 (2026-09-07)

### Minor changes

Initial gate battery and orchestration: eight gate scripts (`diffsize`, `typegate`, `fanout`,
`select-specs`, `complexity`, `mutants`, `tamper`, `scorecard`) each with a named defect class, a cited
source and a fixture-repo test; the `task` skill (verdict → probe → worklist → coders → battery → QA →
computed score → PR); the `setup` skill that configures a repository by interview and verifies every answer
by running it; the `gh-cli` wrapper as the only GitHub surface.

Run history in `git log` is the detailed record: one gate, one decision, one document per commit.
