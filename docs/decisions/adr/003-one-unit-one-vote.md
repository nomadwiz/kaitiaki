# ADR-003 — One unit, one vote — and capture needs far fewer than a majority

**Status.** Accepted, 28 Aug 2026. Amended 29 Aug 2026, and again 30 Aug 2026
when the cost of the decision turned out to be larger than first recorded.

## Context

Voting weight has to come from somewhere. In a body corporate it follows unit
ownership: your levy and your vote both scale with how much of the building you
own. The question this record answers is whether to keep that rule as it is, or
bend it to make the building harder to capture.

**Capture was first understood as a majority problem.** Scenario QAS-9 asks what
happens if one party holds most of the units — the realistic case being the
original developer who has not sold everything yet. That party can vote to admit
a contractor they own to the payee registry, then vote to approve a payment to
it. Every one of the four guarantees holds while it happens. Nothing is
bypassed, nothing reverts, and the record shows an ordinary building.

**Setting the timing parameters showed the majority framing was too generous.**
Three rules compose: quorum is 25%, an ordinary resolution passes on a majority
of votes *cast*, and quorum is waived once the adjournment period has run. Put
them together and after 21 days a payment can be approved by a majority of
whoever bothered to vote — **which can be one owner in forty**
([`spec.md` §5](../../spec.md#5-parameters--statutory-not-chosen)).

That is not a flaw in how the statute was mapped. It is what the statutory
scheme permits, faithfully implemented. In a physical meeting the rule is held
in check by frictions the Act never writes down: somebody has to convene the
meeting, turn up, minute it, and be seen by their neighbours doing it.
Mechanising the rule removes all of them, because the adjournment is automatic
and no human effort is needed to reach the point where quorum stops applying.
**Porting a governance rule onto a chain does not port the informal safeguards
it leaned on.**

**And a third path opened when the accountability layer was removed**
([ADR-012](012-no-built-in-accountability.md)). The annual audit is now the last
remaining check on the management firm, and owners may waive it by special
resolution at 75%. So a party holding three-quarters of the units can appoint a
firm, waive the audit, and approve payments to a vendor they control — with
nothing on the record to distinguish it from a well-run building.

Two fixes were on the table for the original majority case:

- require more than a simple majority to admit a vendor
- cap how many votes any one owner gets, however many units they hold

## Decision

Neither. Voting weight follows unit ownership — one unit, one vote — with no
raised threshold and no cap. The weakness is stated openly in the architecture's
limits section instead (`sad.md` §7.1).

## Consequences

**What we gain.** The design stays consistent with how unit title ownership
actually works. Changing the vote but not the levy would be hard to defend. We
also avoid adding a fix that would not have worked: a raised threshold lifts the
bar for capture from *just over half* to *well over half*, but it lifts the bar
for legitimate vendor approval by exactly the same amount — in a building where
getting even half the owners to vote is the known problem (Falk et al., 2024).
It makes the abuse harder and the ordinary case harder, in equal measure. T4 in
`method/03-drivers.md` records the tension:
there is no threshold that gets both. Rather than split the difference and be
bad at both, we pick one and disclose the cost.

**What we pay, and it is more than this record first said.** Three distinct
capture paths are open, and none is mitigated:

| Path | What it costs the attacker |
| --- | --- |
| Majority of units, as QAS-9 describes | Owning most of the building |
| Majority of votes cast after the quorum waiver | Turning up when nobody else does — potentially one owner in forty |
| Three-quarters of units, waiving the annual audit | Owning 75%, after which no external check remains |

The second is the one that matters, because it is the cheapest by a wide margin
and it does not require owning anything unusual. All the architecture
contributes against any of them is that the vendor being admitted, the vote, the
payee and the payment are permanently public and tied to identities. Nothing
else in the design repairs it.

**Why state it rather than patch it.** A reviewer who reads a plainly stated
weakness concludes the designers saw the attack. A reviewer who finds a
half-measure concludes the opposite. That reasoning held when the exposure was a
majority owner, and it holds more strongly now the exposure is larger — an
unstated finding of this size would read as one that was never seen.

## Alternatives considered

**Raise the threshold for payee admission.** Rejected above: it costs the
legitimate case exactly what it costs the attacker.

**Cap votes per owner.** Rejected because it breaks the levy-and-vote symmetry
that makes the scheme defensible, and it does nothing about the quorum-waiver
path, where the attacker holds one unit rather than many.

**Raise quorum, or remove the waiver.** Not available — both are statutory
values, and [`spec.md` §5](../../spec.md#5-parameters--statutory-not-chosen)
takes them from the Act rather than choosing them. Changing them would be
designing a different legal regime, which this project has no standing to do.
The honest response is disclosure, and future work notes that a system operating
under a revised Act would set them differently.
