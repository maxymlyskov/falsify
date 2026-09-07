# Deferred — other agent CLIs (Codex, Cursor, OpenCode, Gemini)

Not in v0.1. The gates in `bin/` are plain Node and run anywhere; the orchestration (`skills/task/SKILL.md`)
uses Claude Code's skill format, subagent dispatch and `{{SLOT}}` prompt filling. The portable part is the
contract (`skills/task/references/contract.md`): verdicts, probe, worklist, scope, halt codes, gate
battery, computed score.

Would reopen as: a per-skill `agents/openai.yaml` manifest for Codex (mattpocock/skills pattern) once a
Codex run of the contract has produced a scorecard from the same `bin/` gates.
