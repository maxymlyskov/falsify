# The falsify contract

An implementation-agnostic checklist. Port it into whatever harness you use — a slash command, a
system prompt, a CI job, a checklist a human follows. The value is in the ordering and the halt
conditions, not in any particular syntax.

Each step names its **halt condition**: the state in which the agent must stop and surface, rather
than proceed. A gate with no halt condition is a suggestion, and will be treated as one.

---

## 0. Intake

Classify before doing anything else. The classification decides how much machinery runs.

```
KIND:  bug | feature
LANE:  ui | standard | complex
TDD:   yes | no
```

- `KIND: bug` when the report describes an existing capability misbehaving. Otherwise `feature`.
- `LANE: complex` if any of: schema migration in scope, more than one repository affected, a new
  external integration, or both backend and frontend changing.
- `LANE: ui` if the change is presentation-only and the report names no backend concept.
- `LANE: standard` otherwise.
- `TDD: yes` whenever backend logic changes.

**Halt:** input is empty or unparseable → `USAGE`.

---

## 1. Understand — scaled to lane

A fixed question budget for the entire run. Four is a reasonable default.

- Never ask what the ticket, the evidence, or the codebase can answer. Derive it.
- Never ask a preference question. Ask only where different answers produce different code.
- Lead with a recommendation and a one-sentence trade-off, so the answer is a confirmation rather
  than an essay.
- `ui` → skip entirely.
- `standard` → ask only if the brief is thin.
- `complex` → explain in plain language how the touched mechanism works *today* before asking
  anything. If the agent cannot do that, it is not ready to ask questions.

**Halt:** budget exhausted → proceed on the stated recommendations. Do not keep asking.

---

## 2. Evidence — parallel, read-only

Extract every identifier from every source: ticket body, comments, text visible in screenshots,
error strings, the reporter's own phrasing.

Then query the real systems **concurrently** and **read-only**:

- application logs, scoped to the identifier and a bounded window
- the database row(s) in question, explicit columns, bounded limit
- the relevant third-party API, if the symptom crosses a boundary
- documentation for what the feature is *intended* to do

**Integration-specific:** verify the feature is enabled for that account *first*. Evidence gathered
on a disabled feature proves nothing.

**Halt:** every lookup errored → `EVIDENCE_FAILED`. One or two failing is fine; note it and continue.

---

## 3. Verdict — the gate before the branch

Triangulate three sources: **docs** (intended behavior) × **code** (the actual formula, cited as
`file:line`) × **data** (the real configuration). Default hypothesis: working-as-configured.

Resolve to exactly one:

| Verdict | Requires | Next |
|---|---|---|
| `CONFIRMED-BUG` | evidence reproduces the defect AND code contradicts docs + config | → step 4 |
| `WORKING-AS-DESIGNED` | the mechanism reproduces the reported value, correctly | → explain, stop |
| `CONFIG` | a setting produces this, not the code | → name the setting, stop |
| `NOT-BUILT` | the governing path contains no logic addressing the ask | → stop |
| `UNCONFIRMED` | evidence insufficient or contradicts the reported cause | → conflict grill |

**On `UNCONFIRMED`:** ask up to three questions, and each one must *name the conflicting fact*.
Not "can you clarify?" but "the ticket points at `calculateDeposit`, but the configuration row shows
`deposit = 0`, which reproduces the $0 with no defect — is 0% intended?"

**Halt:** still `UNCONFIRMED` after the grill → `DIAGNOSIS_UNCONFIRMED`. Never branch.

**A supplied root cause — a `file:line`, a proposed diff, "the AI said it's X" — is a hypothesis to
disprove, not a specification.**

### Mechanism

For every verdict except `UNCONFIRMED`, write a plain-language walkthrough of what happens and why,
using the real values the evidence returned. This is not decoration: an agent that cannot narrate
the mechanism in prose does not understand it, and the prose is where that becomes visible.

---

## 4. Probe — make the diagnosis executable

`CONFIRMED-BUG` + backend only.

Add **one** assertion to the **existing** test file that owns the code under test, asserting the
value the reporter expected. Run only that test.

It must fail, and `actual` must equal the reported symptom value.

| Outcome | Meaning | Action |
|---|---|---|
| Fails with the reported value | The diagnosis is now executable | Proceed. Keep the probe. |
| Fails with a different value | You are looking at a different bug | Revert. `ASSUMPTION_UNPROVEN`. |
| Passes | There is no bug here | Revert. `ASSUMPTION_UNPROVEN`. |

Give it at most three attempts before halting. The passing-RED probe **is** the first test of the
implementation and is never rewritten.

**UI symptoms:** the equivalent probe is a screenshot showing the defect. Same role, same rule.

---

## 5. Worklist — the single artifact the implementer receives

Numbered. Each item is one file-sized change **with a proof attached**.

```
1. [path/to/service.ts]     <one change> → proof: it("<name>") RED→GREEN in <spec path>
2. [path/to/Component.tsx]  <one change> → proof: <route> renders <expected>
3. [path/to/migration.ts]   <DDL>        → proof: rolled-back transaction; SELECT fails
                                                   before up(), passes after, down() round-trips
```

Rules that keep this honest:

- Map the flow first — entry point `file:line` → service → data layer — then choose the smallest
  design that satisfies the proofs. When two designs both pass, the one touching fewer files wins.
- Every named test file must already exist. **Halt:** a new test path with a sibling in the same
  directory → `NEW_SPEC_REJECTED`. Agents love creating `service.new.spec.ts`.
- Plumbing gets no test of its own; it is covered transitively. Test names should read as
  specifications of the public interface.
- If a probe exists, it is item 1.
- Below the worklist, write the **QA procedure**: 3–8 numbered steps a human performs to prove the
  change, each with the observation that proves it — plus the edge cases this change makes reachable
  (empty, boundary, error, loading, permissions, second tenant).

---

## 6. Scope and gates

```
SCOPE: small   ⟺  ≤3 worklist items
                  AND no schema change
                  AND no pre-existing test lines edited
SCOPE: full    ⟺  otherwise
```

Scope selects gate depth. It never changes what gets built.

**A migration in scope does not force `full`.** Migration risk belongs to the migration gate;
re-running an unrelated suite proves nothing about it. **Touching two repositories does not force
`full`** either, for the same reason.

Run independent gates concurrently. Start slow prerequisites (test containers, database fixtures) in
the background before they are needed.

---

## 7. Stop conditions — the complete list

An implementation is faithful to this spec if, and only if, it can halt on all of these:

| Code | When |
|---|---|
| `USAGE` | no parseable input |
| `EVIDENCE_FAILED` | every evidence lookup errored |
| `INTEGRATION_DISABLED` | the feature is off for this account; evidence would be meaningless |
| `DIAGNOSIS_UNCONFIRMED` | verdict unresolved after the conflict grill |
| `ASSUMPTION_UNPROVEN` | probe passed, or failed with the wrong value |
| `NEW_SPEC_REJECTED` | new test file proposed where a sibling exists |
| `BRANCH_EXISTS` | the target branch is already present |

If your implementation can't halt, you don't have gates. You have prose.
