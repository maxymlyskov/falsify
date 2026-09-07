# burden

Ticket in, proven PR out. A Claude Code plugin that refuses to branch on an unproven diagnosis and refuses
to open a PR below a confidence score it computed — not one the model typed.

Under construction toward v0.1.0. What exists and is stable:

- [docs/thesis.md](docs/thesis.md) — why this exists: the burden of proof is on the agent.
- [skills/task/references/contract.md](skills/task/references/contract.md) — the portable checklist any
  harness can implement: verdicts, probe, worklist, scope, halt codes.
- [docs/worked-example.md](docs/worked-example.md) — a full run where the diagnosis was wrong.
- [docs/open-questions.md](docs/open-questions.md) — what is not yet measured, and what would settle it.
- [docs/adr/](docs/adr/) — the decisions a stranger will question, with their evidence.
- [STYLE.md](STYLE.md) — how every skill file in this repo is written.

Commit history is part of the documentation ([ADR-0006](docs/adr/0006-history-as-documentation.md)):
`git log --oneline -- bin/` reads as each gate's biography.

MIT.
