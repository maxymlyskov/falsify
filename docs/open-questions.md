# Open questions

These patterns come from one engineer, one production codebase, roughly 1,900 pull requests. That is
enough practice to be confident they *feel* right and nowhere near enough to claim they work. This
file is the honest version of that gap.

If you have data on any of it, open an issue. Negative results are the most useful thing you could
send.

---

## 1. Does the verdict gate actually change outcomes?

**Claim:** requiring a `CONFIRMED-BUG` / `WORKING-AS-DESIGNED` / `CONFIG` / `NOT-BUILT` verdict
before branching prevents a meaningful number of unnecessary changes.

**What would settle it:** the rate at which tickets resolve to a non-bug verdict, and what fraction
of those would plausibly have produced a merged code change without the gate. The first number is
easy to collect. The second is a judgment call, which is exactly why it needs more than one observer.

**My own rough figure:** somewhere around one in six bug reports resolves to `CONFIG` or
`WORKING-AS-DESIGNED`. I don't trust the precision — it was never counted systematically, and it
varies enormously by how the reports arrive.

---

## 2. Does the probe reduce defect escape rate, or just feel rigorous?

The honest possibility: the probe is a ritual whose real benefit is that it slows the agent down for
thirty seconds, and any thirty-second pause would do as well.

**What would settle it:** revert rate and reopened-ticket rate for changes that went through a probe
versus changes that didn't, on the same codebase, same author, same period. That comparison is
runnable by anyone who adopts this halfway.

**Confounders that make this hard, listed so nobody pretends they aren't there:** probes are used on
harder bugs, which have higher escape rates for unrelated reasons. Selection is not random and
probably never can be.

---

## 3. Is the value-equality requirement doing real work?

The rule says the probe must fail with the *exact* value the reporter reported, not merely fail.
That's the strictest thing in this repo and the one I'm least sure about.

**Against it:** many real symptoms don't have a single crisp value. "It's slow." "Sometimes the list
is empty." "The email looks wrong." The rule is silent on all of those, which may mean it only
applies to a narrow and unusually well-behaved class of bug.

**For it:** in the cases where it *does* apply, it has caught me repeatedly.

**What would settle it:** how often a probe fails with a *different* value than reported, and what
turns out to be true in those cases. If the answer is "almost never," the requirement is expensive
ceremony. If it's "one in ten and every one was a different bug," it's the most valuable line here.

---

## 4. Where is the scope threshold actually right?

`SCOPE: small` at three or fewer worklist items is a number I picked and never revisited. It could
just as easily be two, or five, or not a count at all.

**What would settle it:** escape rate by worklist length. If four-item changes escape at the same
rate as three-item ones, the threshold is wrong.

---

## 5. Does any of this survive contact with a team?

Everything here was built by one person for one person. Single-author workflows have a property that
teams do not: perfect context continuity. I already know why the gate exists, so I don't route around
it.

**The obvious failure mode in a team:** gates become a thing to satisfy rather than a thing that
helps, and someone writes a probe that fails with the right value by construction rather than by
reproduction. I have no idea how common that would be, because I have never had a colleague to
observe.

**What would settle it:** literally any report from a team that tried this.

---

## 6. Does it still matter as models improve?

The whole premise is that agents produce plausible wrong answers. If a future model's wrong answers
become rare enough, the gates become pure overhead.

I don't think that's close yet — the failure is structural rather than a capability gap. An agent
handed a ticket containing a confident wrong root cause has been given a specification, and being
smarter doesn't obviously help with that, since the human was the one who was wrong. But I hold this
loosely, and it is the question that would most change what this repo is for.

---

## Contributing data

Useful even in small quantities:

- Verdict distribution over any number of tickets — how many resolve to non-bug
- Probe outcomes — failed-as-reported vs failed-differently vs passed
- Revert or reopen rate, gated vs ungated, on the same codebase
- A case where a gate cost you time and bought nothing. Especially this one.

No telemetry, nothing automated, no account required. Open an issue with whatever you have.
