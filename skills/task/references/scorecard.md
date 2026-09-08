# Scorecard — computed by `scorecard`, never typed

Source: Kaner & Bond, METRICS 2004 (construct validity) and the conjunctive rule (ADR-0003). The score
measures one thing: how much of the claimed confidence was **executed this run** vs inherited. It does not
claim to measure correctness — that needs outcomes, which are out of scope; the run record keeps the data
so the weights can be fitted later instead of guessed.

Command: `scorecard .claude/.cache/falsify-run-<TICKET>.json` → prints the `## Confidence` block and
`## Cost`, then `SCORECARD_RESULT`. The block is pasted into the PR verbatim.

## Weights (`bin/scorecard.weights.json`)
```json
{ "provenance": "prior — unmeasured; fit against outcomes when outcome tracking exists",
  "hard": ["G0","G1","G3","TAMPER","G4","G7","QA"],
  "weights": {"Diagnosis":20,"Behaviors":20,"Regression":15,"Mutation":15,"RealWorld":10,"FanOut":10,"QA":10,"Complexity":5,"Cleanliness":5},
  "tier": {"A":1.0,"B":0.5},
  "verdict": {"HIGH":90,"MEDIUM":75} }
```

## Algorithm
1. **Hard gates.** Any hard gate with `pass:false` (or `pass:null` for G3/TAMPER, or `QA.blocking > 0`,
   or a hard gate never recorded) → score 0, verdict `NOT SHIPPABLE`, the gates listed. No averaging.
2. **Evidence score** over the applicable rows: `score = 100 × Σ(w·t·pass) / Σ(w over rows whose tier ≠ —)`.
   `Diagnosis` only for bugs (tier A with a probe, B without). `QA` = weight × fraction of procedure steps
   with `[A]` evidence. `Mutation` drops to tier B when `equivalent > tried/2`. A gate with `pass:null` is
   `[—]` with its code as the reason and leaves the denominator. A row never recorded stays in the
   denominator and earns nothing.
3. **Override.** If the row for `ticketDimension` (the dimension the ticket is about — Regression,
   RealWorld, Behaviors, …) is tier B → verdict capped at `MEDIUM`.

Verdict: `HIGH ≥ 90 · MEDIUM 75–89 · LOW < 75 · NOT SHIPPABLE` on step-1 failure. Exit 0 on HIGH/MEDIUM,
1 otherwise — the exit code reports the arithmetic, not permission to ship: only HIGH lets step 9 open a
PR on its own, and MEDIUM's exit 0 still returns to the battery unless the user says otherwise. Arithmetic: the priors sum to 110 for a bug and 90 for a feature, so Regression at B alone
gives 93.2 (bug) / 91.7 (feature) — HIGH; Regression + Fan-out at B gives 88.6 / 86.1 — MEDIUM. Two
inherited rows on important dimensions is where PRs go wrong; that boundary is the intended behaviour.

## Tiers
`[A]` this run executed the measurement · `[B]` inherited, asserted or proxy (`scoped — CI`, `G4 proxy`,
a prior run) · `[—]` structurally inapplicable with a stated reason. The orchestrator writes the tier when
it records the gate; the script never upgrades one.

## Example block
```
## Confidence
Diagnosis     CONFIRMED-BUG — probe deposit.spec.ts "charges $50 for a 2-lane package" expected 50 got 0 [A]
Behaviors     1 RED→GREEN                                                                    [A]
Regression    select-specs: 2 specs, 489 passing, 0 failing                                  [A]
Fan-out       1 flagged (deposit.mapper.ts, conf 0.8) — edited in round 2                    [A]
Complexity    worst calculateDeposit cyclomatic 7 / 10 · cognitive 9 / 15                    [A]
Mutation      killed 3 of 3 tried (candidates 3) · survivors 0 · equivalent 0                [A]
Real-world    G4 whole owning spec ran                                                       [A]
Cleanliness   0 fixes                                                                        [A]
QA            5/5 procedure steps [A] · 3 edge cases · 6 house checks (0 fired) · blocking 0 [A]
Size          14 LOC · Tamper clean · Types base 0 → branch 0
Score 100 / 100 · Verdict HIGH · rounds 2 · wall 9m41s · weights: prior — unmeasured; fit against outcomes…

## Cost
rounds 2 · wall 9m41s
 1 Intake       1m00s
 7 Battery      5m00s
SCORECARD_RESULT {"ok":true,"pass":true,"score":100,"verdict":"HIGH","hardFailed":[],"rows":{...}}
```

## Run record (input) — `.claude/.cache/falsify-run-<TICKET>.json`
Created in step 1, appended by every step, deleted in step 11 on success, kept on halt for `resume`.
```json
{ "ticket": "212", "kind": "bug", "lane": "standard", "tdd": true, "scope": null,
  "started": "…", "ended": "…", "budgetMin": null, "degraded": [],
  "steps": { "1": {"started": "…", "ended": "…"}, "7": {"started": "…"} },
  "verdict": "CONFIRMED-BUG", "probe": {"spec": "src/deposit.spec.ts", "it": "…", "expected": 50, "actual": 0},
  "gates": { "G0": {"result": {…}, "tier": "A"}, "G1": {"result": {…}, "tier": "A", "round": 2},
             "G2": {…}, "G3": {"result": {"pass": true, "behaviors": 1, "passing": 1, "failing": 0}, "tier": "A"},
             "G4": {"result": {"pass": true, "specs": [{…}], "passing": 489, "failing": 0}, "tier": "A", "round": 2},
             "G5": {…}, "G6": {…}, "G7": {"result": null, "tier": "B", "reason": "G4 whole-spec run stands as proxy"},
             "G8": {"result": {"pass": true, "fixes": 0, "findings": 0}, "tier": "A"}, "TAMPER": {…},
             "QA": {"steps": 5, "stepsA": 5, "edge": 3, "house": 6, "fired": 0, "blocking": 0} },
  "rounds": 2, "ticketDimension": "Regression" }
```
Gate fields the rows read: G3 `behaviors|passing, failing`; G4 `specs, passing, failing`; G7 `text`;
G8 `fixes, findings`; the others are the scripts' own RESULT objects.
