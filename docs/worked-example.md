# A worked example

The interesting runs are the ones where the gates catch something. Here is one, reconstructed and
anonymized: a subscription billing system, a reported invoicing defect, and a diagnosis that was wrong.

---

## The ticket

> **Discount is $0 on every invoice for Acme Freight**
>
> Customer called — their contracted discount stopped applying on Tuesday. Should be 20%.
> Looks like the bug is in `invoice.service.ts:214`, the discount calculation is returning zero.
> Probably the rounding change that went out Monday.

Note what's already happened. The report contains:

- a **symptom** (discount is $0)
- a **root cause** (`invoice.service.ts:214`)
- a **culprit** (Monday's rounding change)

Two of those three are guesses, and they were written by someone with more context than the agent
has. Hand this ticket to an unguarded agent and it will fix line 214, because that's what it was
told to do.

---

## Step 0 — Intake

```
KIND:  bug        — an existing capability is misbehaving
LANE:  standard   — backend only, no migration, one repo
TDD:   yes        — backend logic in scope
```

## Step 2 — Evidence

Identifiers extracted: account `Acme Freight`, the date `Tuesday`, the symptom value `$0`, the
expected `20%`, the named file `invoice.service.ts`.

Four lookups dispatched in parallel, all read-only:

```
logs      → discount calculations for Acme Freight, last 7 days
             → 1,204 calls. No errors. No exceptions. All returned 0.
database  → the account's billing configuration row
             → discount_percent = 0       <-- the whole story
             → updated_at = Tuesday 09:14
docs      → intended discount behavior
             → "discount_percent of 0 disables the contracted discount entirely"
code      → invoice.service.ts:200-230
             → discount = subtotal * (config.discount_percent / 100)
             → correctly returns 0 when discount_percent is 0
```

The absence of errors was the first real signal. A calculation bug that silently returns zero across
1,204 calls without a single exception is possible but unusual. A configuration that says *don't
apply a discount* explains it without any defect at all.

## Step 3 — Verdict

Triangulating:

- **Docs** say `0` disables the discount. Intended behavior exists and is documented.
- **Code** at the named line reproduces `$0` from `discount_percent = 0`, correctly.
- **Data** shows `discount_percent = 0`, changed Tuesday at 09:14 — matching the reported onset
  exactly.

All three agree, and none of them is a defect.

```
Diagnosis: CONFIG
```

**Mechanism:** On Tuesday at 09:14 someone set this account's discount percentage to 0. The invoice
service reads that value, multiplies the subtotal by `0/100`, and returns `$0` — which is precisely
what the documentation says a `0` should do. Monday's rounding change is not involved: it operates on
the result of this multiplication, and zero rounds to zero under any rounding rule.

**No branch was created. No code was written.**

The resolution is a question for the customer — *did you mean to turn the discount off on Tuesday?* —
and possibly a product observation, that it is too easy to zero out a contracted rate with no
confirmation step.

---

## What each gate bought

**The verdict gate** stopped a code change to a file that was working correctly. Without it, the
agent would have "fixed" line 214 — most likely by special-casing zero, or by adding a fallback
percentage. Both would have been merged. Both would have quietly broken every account that had
deliberately set its discount to zero. The original problem would have remained, because it was never a
code problem.

**Evidence-before-hypothesis** is what surfaced the `updated_at` timestamp. An agent that had started
from "the rounding change broke it" would have gone to Monday's diff and read it looking for the bug
it had already been told was there. It would have found *something* — every diff contains something
if you need it to.

**The probe** never ran, and that's the point: the run halted one gate earlier. Had it reached the
probe, the probe would have failed correctly — asserting `discount === 45.00` would have produced
`expected 45.00, got 0.00`, matching the report, and the run would have continued to fix a
non-existent bug. Which is worth sitting with: **the probe is necessary but not sufficient.** It
proves you have reproduced the symptom. It does not prove the symptom is a defect. That's the
verdict's job, and it's why the verdict comes first.

---

## The counterfactual

Time spent: about four minutes, most of it waiting on parallel queries.

Time that would have been spent without the gates: a branch, a patch, a test written against the
theory, a review, a merge, a deploy — and then a second ticket in a week's time from a different
customer whose intentionally-zero discount had started applying.

That second ticket is the expensive one, and it is invisible in any metric that counts how fast the
first ticket closed.
