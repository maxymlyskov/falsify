# Recipes

Everything here reads `.claude/falsify.config.json` (written by `/falsify:setup`). Section names are
referenced from `SKILL.md` as `§name`. Gate scripts are run as `node "${CLAUDE_PLUGIN_ROOT}/bin/<gate>" …`.

## §config — the keys the recipes use
```
tracker.kind · tracker.idPattern · tracker.fetch ({id})            · tracker.comment ({id} {file}) | null
test.command ({spec} {grep} {db}) · test.failRegex · test.specGlob · test.setup | null
test.readyCheck | null · test.dbNameEnv | null · test.dbCreate ({db}) | null
git.remote · git.base · git.branchTemplate ({id} {slug}) · git.commitTemplate ({type} {what} {id})
typecheck.roots · typecheck.command
ui.screenshot ({route} {expect} {out}) | null
db.url | null                    (a test database for migration proofs; never production)
evidence[]  {name, command ({q}), readOnly: true}
gates.size {halt, warn} · gates.complexity {cyclomatic, cognitive} · gates.mutation {max, small}
gates.fanout {conf, support, window, rules[]} · gates.regression {depth, max} · gates.clean {command | null}
invariants[] · houseRules[] · handoff.comment (pr | tracker | none) · handoff.docsDir | null
```
A missing optional key makes the dependent gate report `[—] not configured` — never an error.

## §evidence — lookups for a bug (step 2)
Extract identifiers from all sources (ticket, comments, text visible in screenshots, `$ARGUMENTS`): ids,
emails, account/tenant names, `Controller.method`, error codes, external ids. For each entry in
`evidence[]` whose `name` matches the symptom domain, run `command` with `{q}` = the identifier, **as a
single quoted argument**; run independent lookups in parallel; read-only only (`readOnly: true` is
required to be listed at all). Every lookup errored → halt `EVIDENCE_FAILED: <last stderr>`. No
`evidence[]` configured → the verdict rests on code + docs + the reporter's values; say so in
`Evidence:`. Feature flags: if the symptom belongs to a feature behind a setting, verify the setting is
enabled for the reporter's account first — disabled → halt `FEATURE_DISABLED: <setting>=false; evidence
on a disabled feature proves nothing`.

**Verdict** — the go/no-go before any branch. Default hypothesis: working-as-configured. Clear it only by
triangulating docs (intended) × code (`file:line` formula) × data (actual configuration). A pre-supplied
root cause (`file:line`, proposed diff, "the AI said") is a hypothesis to disprove, not a spec.
- `CONFIRMED-BUG` — evidence reproduces the defect AND the code contradicts config + documented behavior.
- `WORKING-AS-DESIGNED` / `CONFIG` — name the exact setting, the doc that intends it, and how the
  mechanism reproduces the reported value → no branch, no PR.
- `NOT-BUILT` — the governing path has no logic addressing the ask (cite the `file:line` range read), no
  doc/decision/setting says otherwise, today's behavior holds as deliberate. "No setting exists" is not a
  defect, and another code path enforcing the behavior is not intent evidence.
- `UNCONFIRMED` — evidence insufficient or contradicts the reported cause → ≤ 1 conflict question that
  names the conflicting fact ("the ticket points at `calculateDeposit`, but the account row shows
  `deposit = 0`, which reproduces the $0 with no defect — is 0% intended?"). Unresolved → halt
  `DIAGNOSIS_UNCONFIRMED: <what's missing>`. Never branch on an unconfirmed diagnosis.

**Mechanism** (every verdict except UNCONFIRMED, unless `no unravel`): a plain-language walk-through of
what happens and why, using the real values Evidence returned. An agent that cannot narrate the
mechanism does not understand it, and the prose is where that becomes visible.

## §testdb — test database prerequisite + readiness (any spec in the worklist)
1. `test.setup` set → run it (e.g. `docker compose -f test/docker-compose.yml up -d`). Failure → halt
   `TEST_DB_DOWN: <stderr>`.
2. `test.readyCheck` set → loop it up to 30 × 2 s before the first test run. Never start a suite against
   a service that is still booting: connection-refused is indistinguishable from RED. Still not ready
   after 30 tries → `ENV_BLOCKED` (`gates.md` §Environment): name the command and its output and ask the
   user before anything else runs. Never continue with the specs it gates skipped.
3. `test.dbNameEnv` set → one database per coder and per QA agent, created before dispatch with
   `test.dbCreate` (`{db}` = `<base name>_<n>`; "already exists" is fine). `{db}` goes into every coder
   prompt via `{{TEST_CMD}}`; the orchestrator's own gate runs use the base name. Source: Luo et al.,
   FSE 2014 — concurrency and order dependency are 32% of flaky tests.
None of the three set → skip this section; record `testdb: none` in the run record.

## §testcmd — the canonical test command
`test.command` with slots: `{spec}` the spec path relative to the app root, `{grep}` one test name or an
alternation of this task's names, `{db}` the database name (empty when `test.dbNameEnv` is null). Every
build-time run passes `{grep}` (one behavior while iterating; the alternation when checking together).
Whole-file runs happen once, at G4, on the specs `select-specs` picks — nowhere else, and never inside QA
(`gates.md` §QA). No `.only` survives to commit.
Pass/fail is read from `test.failRegex` (mocha `N failing`, jest/vitest `N failed`, node:test `# fail N`);
a non-zero exit without a matching line is not a failed test — it is a broken run. On Windows a command
with a POSIX env prefix runs under bash (`mutants` does this itself).

## §migration — the only sanctioned proof (expand → migrate → contract)
Never point the ORM's migration runner at a synchronized test schema — the migrations table is empty
while every prior migration's effect already exists, so a cold run replays from the start and dies on an
existing table (incidents.md, 2026-08). Prove `up()` AND `down()` in one rolled-back transaction against
`db.url` (a test database, never production):
```
psql "$DB_URL" <<'SQL'
BEGIN;
<seed 3–5 rows, one per branch of the migration's WHERE predicate>
<up() statements verbatim>
<SELECT the changed rows + information_schema.columns column_default>
<down() statements verbatim>
<same SELECTs — assert the intended round-trip>
ROLLBACK;
SQL
```
A data migration (any `UPDATE`) seeds a row for each predicate branch and asserts `down()`, not just
`up()` — that is what catches a `down()` that re-enables a setting on rows created after the migration.
A new enum member → the same block proves `SELECT '<v>'::<type>` fails before `ADD VALUE`, succeeds
after. Print the SQL first: new columns nullable/defaulted, no drops; a hot table = deploy risk, flag it.
`db.url` null → G7-migration is `—` with reason `no test database configured`, and the PR body carries
the migration SQL under `## How to Test` for a human.

## §screenshot — frontend proof (G7 and QA)
`ui.screenshot` with `{route}` `{expect}` `{out}` produces a PNG the orchestrator and QA **Read**. One
screenshot per state the diff adds. When the configured command cannot reach a surface (auth, a route the
component gates on), the fallback is a throwaway preview page mounting the component under a fake store —
named `preview-<TICKET>-<surface>.*`, never committed, removed before the report; the recipe that
applies is pasted into `{{PREVIEW_RECIPE}}` for QA. `ui.screenshot` null, or exiting non-zero, on a frontend change →
`ENV_BLOCKED` (`gates.md` §Environment): say which command is missing or failing and ask; only on the
user's go-ahead is G7 `[B]` with reason `no screenshot command configured`, and then the PR body names
the screens to check by hand.

## §delegation — the delegation floor
Write it yourself when a subagent cannot pay for itself: a worklist item that is one file and under ~20
lines with no investigation in it (a migration, an enum member, a default flip, a copy string, a type
addition) is faster to type than to brief, and a briefed agent can wander (incidents.md, 2026-08:
12 lines, 15 minutes). Delegate when the item needs real reading, or runs concurrently with other items
and is not the longest pole. The floor never applies to `TDD: yes` items.
- `ui` lane: edit directly. No subagents.
- `TDD: yes`: one `tdd-implementer` (sonnet) per distinct spec file, `prompts/tdd-implementer.md` with
  the worklist slice as `{{BEHAVIORS}}` (probe exists → behavior 1 is already RED, start at the SUT).
  Parallel only across different spec files; max 4 in flight.
- Other items above the floor: `implementer` (sonnet), parallel when files are disjoint, max 4.
- Dispatch every ready subagent in ONE message. Prompts carry only the slots in the placeholder table —
  never the raw ticket or thread. `TDD_BEHAVIOR_TIMEOUT` / `TDD_VACUOUS_RED` → a failed gate in the
  battery loop, repaired by the orchestrator; `TEST_DB_UNREACHABLE` → fix §testdb, re-dispatch the slice.
