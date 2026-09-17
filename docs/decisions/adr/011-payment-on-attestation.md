# ADR-011 — Payment is released by the firm's attestation, with nothing in between

**Status.** Accepted, 29 Aug 2026. Supersedes the objection window described in
[`product.md` §11.4](../../product.md#114-completion-attestation-and-the-objection-window).

## Context

Somebody has to assert that work was done. No contract can check whether a roof
was repaired, so that assertion is the design's irreducible trust boundary.

For most of this project's life the answer was an **objection window**: the firm
attests, owners get a period to object, and absent objection the treasury pays.
Setting its duration and its threshold forced the question of what it was
actually for, and the answer did not survive the asking.

Three designs were tried in that gap.

**An objection window with a real veto.** Any owner could block. The problem is
what happens next: New Zealand construction payment runs on "pay now, argue
later" — under the Construction Contracts Act 2002, a contractor who has done the
work is paid, and disputes are resolved afterwards through adjudication, not by
withholding. A design letting owners freeze a contractor's payment on suspicion
is *less* aligned with the law of this domain, not more. And at the participation
levels this project assumes throughout, a veto requiring an owner to notice would
almost never fire — a safeguard calibrated so it cannot operate is worse than
none, because it reads as protection.

**Owner completion approval.** Payment releases when the firm *and* enough owners
confirm. This genuinely closes the circularity — the firm could no longer certify
its own work and be paid on its word alone. It was rejected because it makes a
contractor's payment hostage to owner attention. A vendor who has finished the
job waits on forty people to open an app.

**A waiting period with no veto.** Owners could approve early but not block, so
payment always released and the window only postponed it. A mechanism that cannot
change an outcome is theatre.

## Decision

The firm attests completion. **Payment releases.** No waiting period, no owner
approval, no objection, no veto.

## Consequences

**What we gain.** The design becomes internally consistent: every control sits at
authorisation, every remedy sits after payment, and no party's money is held
against another party's diligence. It also matches the domain's own posture
rather than inventing a stricter one. And the build gets simpler — one fewer
state, one fewer timer, one fewer refusal to test.

**What we pay, and it is the design's central limitation.** A false attestation
releases the money immediately, with nothing in the way. The architecture does
not prevent this, does not detect it, and does not claim to. What it does is make
it **provable once suspected** — the proposal, the vote, the payee, the amount,
the fund, the attester and the evidence hash are permanently public and
attributable. That is what a later audit or adjudication works from.

**Say it positively.** Owners control what may be authorised and who may be paid.
Nobody controls whether approved work gets paid. That separation is clean, and it
puts the owners' safeguards where they can realistically be exercised — at a
scheduled vote, not at an unscheduled inspection.

**A competent engineer could reasonably have chosen otherwise**, which is why
this record exists. The objection window is the conventional answer and it is
what the original proposal specified.
