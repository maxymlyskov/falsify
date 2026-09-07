---
"burden": minor
---

Initial gate battery and orchestration: eight gate scripts (`diffsize`, `typegate`, `fanout`,
`select-specs`, `complexity`, `mutants`, `tamper`, `scorecard`) each with a named defect class, a cited
source and a fixture-repo test; the `task` skill (verdict → probe → worklist → coders → battery → QA →
computed score → PR); the `setup` skill that configures a repository by interview and verifies every answer
by running it; the `gh-cli` wrapper as the only GitHub surface.
