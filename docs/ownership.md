# Who owns what

Three verticals, one owner each. This file is a decision, not a status board —
it changes when ownership changes, which should be rarely. **Task state lives on
the GitHub issues**, never here.

| Owner                  | Vertical      | Contracts                                                     | Requirements                     | Refusal tests their code must pass |
| ---------------------- | ------------- | ------------------------------------------------------------- | -------------------------------- | ---------------------------------- |
| `@nomadwiz`            | **Money in**  | `MembershipRegistry`, `LevyLedger`, the mock settlement token | FR1, FR2, FR5–FR9, FR19          | B1, B8                             |
| `@tutd-work`           | **Money out** | `Treasury`, `PayeeRegistry`                                   | FR12, FR13, FR30–FR35            | B2′, B3, B4, B5                    |
| `@laysokhour-computer` | **Decisions** | `Governance`, `Timelock`                                      | FR16–FR18, FR20–FR22, FR25, FR26 | B2, B6                             |

## Nobody tests their own contracts

The refusal tests for each vertical are written by a different member:

- Money out's four guards — **B2′, B3, B4, B5, which are exactly G1 to G4** — are
  written by `@nomadwiz`
- Decisions' guards, B2 and B6, by `@tutd-work`
- Money in's guards, B1 and B8, by `@laysokhour-computer`

This is free peer review, and it catches the failure a single author cannot: a
test that encodes the same misunderstanding as the code it is testing.

## Outside the verticals

| Work                                                                                    | Owner                         |
| --------------------------------------------------------------------------------------- | ----------------------------- |
| Repository, Hardhat, CI, gas and coverage tooling, the contract interfaces              | `@laysokhour-computer`        |
| Test-network funds, the read interface, deployment                                      | `@tutd-work`                  |
| Events and the replay test (FR39, FR40, QAS-4)                                          | `@nomadwiz`                   |
| Screenshots and evidence capture                                                        | all three, for their own work |
| Report Sections 1, 2, 5 and 6; the final consistency pass; reviewing every pull request | `@nomadwiz`                   |
| Report Section 3                                                                        | `@tutd-work`                  |
| Report Section 4                                                                        | `@laysokhour-computer`        |

## Working across a boundary

The build order is nearly serial — Money out needs Money in's `isOwner`,
Decisions needs both — so you will need something that does not exist yet.
**Write against the interface and use a stub.** Do not implement another
vertical's contract to unblock yourself; raise it on the issue and say what you
need.

If a change has to touch another vertical's contract, the owner of that vertical
reviews the pull request.

## How we work

**The GitHub issues are the checklist.** There is no task list file in this
repository, on purpose: a file three people tick on three branches conflicts
constantly, and a ticked box proves only that someone believed the work was
finished. An issue closes because a reviewed pull request merged.

To pick up work:

```
gh issue list --assignee @me                 # what is mine
gh issue view <n>                            # the task and its acceptance criteria
git checkout -b <n>-short-description        # one branch per issue
```

- Tick an acceptance criterion on the issue only once its test passes
- Open a pull request whose title names the issue and whose description says
  `Closes #<n>`. It needs one approving review before merge
- Keep the requirement and test identifiers the issue names (`FR31`, `G1`, `B3`)
  in commit messages and pull request descriptions. The report cites them, so
  never renumber or invent one

## Definition of done

An issue is done when:

1. its tests pass in CI,
2. one other member has approved the pull request, and
3. any evidence the report needs — a screenshot, a test listing, a gas table — is
   committed under `evidence/`.

Capture evidence as you go. Screenshots taken in the last week tend to be
unreadable, and a figure nobody can explain earns no marks.
