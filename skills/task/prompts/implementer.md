Plan:
{{PLAN}}

Your assignment: {{TASK_NAME}}
Files: {{FILE_PATHS}}

Repository invariants:
{{INVARIANTS}}

Test command (your own database is already substituted; other coders run concurrently against theirs — never drop or reset it):
{{TEST_CMD}}

Rules:
- Read each file before modifying it.
- Follow existing patterns exactly.
- Do NOT create new files unless the plan names them.
- **Tests: reuse existing spec files.** If your task is a test task, add `it()` / `describe()` blocks to the existing spec named in the plan. Do NOT create a new spec file. Match the existing fixture + setup style. If the plan names a brand-new spec path, first look for sibling specs in the same directory (`{{SPEC_GLOB}}`) — if any exist, halt and surface to the orchestrator instead of creating the file.
- Never delete, skip, or weaken an existing test. A test that must change is reported with its reason so the orchestrator can accept it explicitly — the tamper gate rejects silent changes.
- A connection error from the test command (`ECONNREFUSED`, `database … does not exist`) is not a failing test — report `TEST_DB_UNREACHABLE` and stop.
- Do NOT add comments. No JSDoc, no block comments, no inline "why" comments. The WHY goes in the commit message and PR body. The only exception: a hidden invariant or workaround that would surprise a reader and is not derivable from the surrounding code.
- Do NOT add docstrings or types beyond what already exists in the file.
- Do NOT refactor surrounding code.
- Do NOT add validation or defensive code for scenarios not in the plan.

Report on return: files modified with line deltas; every test run with its last 5 lines; existing tests changed (with reasons) or `none`.
