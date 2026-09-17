# Documentation index

Every document in this repository, and what each one is for. Start with whichever
row matches what you came for. If you are about to write code, read
[`spec.md`](spec.md) first.

## The documents

| File | What it is |
| --- | --- |
| [`product.md`](product.md) | **The product in plain language.** The problem, who has it, the evidence and literature, how money moves, why a blockchain, the build plan and the timeline |
| [`sad.md`](sad.md) | **The Software Architecture Description.** The architecture itself — requirements, drivers, the five views, perspectives, evaluation, limits. The report's System Design section is cut from this |
| [`spec.md`](spec.md) | **The build specification.** A condensed extract of the architecture: the four guarantees, each contract and its checks, the parameters, the events, the refusal tests, the requirements and the stack |
| [`ownership.md`](ownership.md) | Who owns which contracts, who writes which tests, and how an issue goes from picked up to merged |
| [`decisions/adr/`](decisions/adr/index.md) | The thirteen decision records, one superseded, and the rule for what earns one |
| [`decisions/views/`](decisions/views/) | The five architecture views, one file each |

### Jump into the SAD

| Looking for | Go to |
| --- | --- |
| Who reads this and where they should start | [§1 Purpose and readers](sad.md#1-purpose-readers-and-how-to-read-this) |
| The constraints we are working inside | [§2.1 Constraints](sad.md#21-constraints--fixed-and-not-ours-to-trade) |
| The three drivers, and what was ranked out | [§2.2 Drivers](sad.md#22-drivers) |
| The scenarios behind them | [§2.3 Scenarios](sad.md#23-quality-attribute-scenarios) |
| The four guarantees, G1–G4 | [§2.4 The guarantees](sad.md#24-the-guarantees) |
| The parameter values, and where each comes from | [§2.5 Configured parameters](sad.md#25-configured-parameters-and-where-each-value-comes-from) |
| Who may start what | [§3.1 Context view](sad.md#31-context-view) |
| Where authority stops, and every path that moves money | [§3.2 Functional view](sad.md#32-functional-view--the-permission-structure) |
| The loop, and the places it refuses | [§3.3 Behavioural view](sad.md#33-behavioural-view--the-loop-and-where-it-refuses) |
| What is recorded, and who that exposes | [§3.4 Information view](sad.md#34-information-view) |
| Why a blockchain and not a database | [§3.5 Deployment view](sad.md#35-deployment-and-network-view) |
| The tests, and what cannot be tested | [§5 Evaluation](sad.md#5-evaluation) |
| What is built versus described | [§6.1 Realisation](sad.md#61-what-is-built-what-is-described) |
| **The requirements, FR1–FR42 and NFR1–NFR15** | [§6.2 Requirements](sad.md#62-requirements) |
| What the design does not prevent | [§7.1 Limits](sad.md#71-what-the-architecture-does-not-prevent) |
| Future work | [§7.5 Future work](sad.md#75-future-work) |
| Where the assessor finds each mandated item | [§9 Coverage map](sad.md#9-coverage-map) |

## The views

Each is one section of the SAD, kept as its own file because that is where it is
edited. [§3](sad.md#3-views) points at all five rather than repeating them, so
each sentence exists once. Seven parts each: presentation, element catalogue,
context, rationale, alternatives considered, evaluation, perspectives.

| View | Answers | Figure |
| --- | --- | --- |
| [Context](decisions/views/context-view.md) | Who may start what; what we depend on but do not control | Figure 1 — Use case view |
| [Functional](decisions/views/functional-view.md) | Where does authority stop; where is every path that moves money | Figure 2 — Component view |
| [Behavioural](decisions/views/behavioural-view.md) | How the loop unfolds, and what it refuses | Figure 3 — Sequence view |
| [Information](decisions/views/information-view.md) | What is on the chain, what is hashed, who it exposes | Figure 4 — Class view |
| [Deployment](decisions/views/deployment-view.md) | What it runs on, and can any one party control it | Figure 5 — Deployment view |

**The figures are not in this repository yet.** All five are pages of one drawio
file held with the report drafting. Until they are exported and committed, a
`Figure N` reference in these documents is plain text with nothing behind it.

## The decisions

| ADR | |
| --- | --- |
| [001](decisions/adr/001-narrow-release-interface.md) | The treasury has only one way to pay money out |
| [002](decisions/adr/002-fee-retention-separate.md) | The firm's withheld fees are kept in their own contract — **superseded by 012** |
| [003](decisions/adr/003-one-unit-one-vote.md) | One unit, one vote — and capture needs far fewer than a majority |
| [004](decisions/adr/004-versioning-out-of-scope.md) | New versions of the contracts are out of scope |
| [005](decisions/adr/005-arrears-published-per-unit.md) | Arrears are published per unit, not just as a building total |
| [006](decisions/adr/006-no-committee.md) | There is no elected committee |
| [007](decisions/adr/007-proof-of-authority.md) | Permissioned proof of authority, not proof of stake |
| [008](decisions/adr/008-immutable-plan.md) | The maintenance plan cannot be edited once ratified |
| [009](decisions/adr/009-publicly-readable.md) | The ledger is readable by anyone, not gated to citizens |
| [010](decisions/adr/010-one-standard-set.md) | One standard contract set, published once, instantiated per building |
| [011](decisions/adr/011-payment-on-attestation.md) | Payment is released by the firm's attestation, with nothing in between |
| [012](decisions/adr/012-no-built-in-accountability.md) | Accountability is external; the architecture supplies evidence |
| [013](decisions/adr/013-own-voting-contract.md) | The voting contract is written for this project, not extended from a library |

## Where the identifiers are defined

Never renumber or invent one: the report cites them.

| Prefix | Means | Defined in |
| --- | --- | --- |
| **FR**, **NFR** | A requirement | [`sad.md` §6.2](sad.md#62-requirements), condensed in [`spec.md` §8](spec.md#8-requirements) |
| **G1–G4** | A guarantee the architecture makes | [`sad.md` §2.4](sad.md#24-the-guarantees), condensed in [`spec.md` §2](spec.md#2-the-four-guarantees) |
| **P1–P7** *(parameters)* | A configured value | [`sad.md` §2.5](sad.md#25-configured-parameters-and-where-each-value-comes-from), values in [`spec.md` §5](spec.md#5-parameters--statutory-not-chosen) |
| **QAS-n** | A quality attribute scenario | [`sad.md` §2.3](sad.md#23-quality-attribute-scenarios) |
| **P1–P3**, **S1–S4** | A primary or secondary driver | [`sad.md` §2.2](sad.md#22-drivers) |
| **C1–C15** | A constraint | [`sad.md` §2.1](sad.md#21-constraints--fixed-and-not-ours-to-trade) |
| **B1–B8, B2′** | A refusal in the loop | [`sad.md` §3.3](sad.md#33-behavioural-view--the-loop-and-where-it-refuses), as tests in [`spec.md` §7](spec.md#7-the-eight-refusals--each-one-is-a-test) |
| **UC1–UC11** | A use case | [`sad.md` §3.1](sad.md#31-context-view) |
| **Q0–Q21** | A reader's concern | the derivation, which is not in this repository |
| **R1–R7** | A reader of the description | [`sad.md` §1](sad.md#1-purpose-readers-and-how-to-read-this) |
| **ADR-nnn** | A decision record | [`decisions/adr/index.md`](decisions/adr/index.md) |
| **`[ASSUMED]`** | A value invented rather than sourced | [`sad.md` §7.3](sad.md#73-assumptions--things-a-decision-rests-on) |

## Changing these documents

Nothing here is generated. Edit the file that owns the fact and nothing else:

- **[`sad.md`](sad.md)** owns the architecture. Requirement identifiers are
  defined in its §6.2 and nowhere else.
- **[`product.md`](product.md)** owns the problem, the evidence, the literature,
  the build plan and the timeline.
- **[`spec.md`](spec.md)** is a condensed extract for building from. If it
  disagrees with `sad.md`, `sad.md` is right and `spec.md` needs correcting.
- **[`ownership.md`](ownership.md)** owns who does what. Task state lives on the
  GitHub issues, never in a file.
- A view or an ADR owns its own reasoning. [`sad.md` §3](sad.md#3-views) points
  at the views; it does not repeat them.

Links are relative and stay inside `docs/`. Anchors are GitHub heading slugs, so
a renamed heading breaks every link to it — search for the old anchor before
renaming one.

**What is deliberately not here:** the derivation of every conclusion (how a
driver was ranked, why a view exists, how the parameters were closed), the drawio
source for the figures, and the report itself. Those sit with the report drafting
outside this repository. Nothing in this repository depends on them.
