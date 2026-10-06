// Screen 1, Home (`#/`): the two funds, what needs the viewer's vote, their
// levies and the four guarantees. A proposal the viewer can vote on carries
// its VoteControl here until #152 moves the vote to the proposal screen.
import { Fragment, type FormEvent, type ReactNode } from "react";

import { date, nzd } from "../format.js";
import { Address, PageHead } from "../shell.js";
import type { View } from "../view.js";

type Proposal = View["proposals"][number];
type OnVote = (proposalId: bigint, inFavour: boolean) => void;

const TONE = {
  Open: "info",
  Extended: "wait",
  Passed: "ok",
  Failed: "fail",
  Queued: "wait",
  Executed: "done",
} as const;

const FUNDS = [
  ["op", "Operating", "Running costs: cleaning, power, insurance."],
  ["ltm", "Long-term maintenance", "Roof, lifts, cladding. Saved over years."],
] as const;

const GUARANTEES = [
  [
    "Approved proposal",
    "No one can spend without a proposal that owners passed.",
  ],
  [
    "Approved vendor",
    "Money goes only to a vendor owners approved, and only the one the proposal names.",
  ],
  ["Within the cap", "A proposal never pays more than its spending cap."],
  [
    "Right fund",
    "A proposal pays only from the fund it names. The two funds never mix.",
  ],
] as const;

function Guarantees() {
  return (
    <div className="guarantees">
      <strong>The contract protects the money:</strong>
      {GUARANTEES.map(([name, sentence]) => (
        <details key={name}>
          <summary>{name}</summary>
          <p>{sentence}</p>
        </details>
      ))}
    </div>
  );
}

function VoteControl({
  proposal: p,
  voting,
  onVote,
}: {
  proposal: Proposal;
  voting?: bigint;
  onVote?: OnVote;
}) {
  const n = p.unvoted.length;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const button = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    onVote?.(p.id, button.value === "true");
  };
  return (
    <form className="vote" data-proposal={String(p.id)} onSubmit={submit}>
      <p className="vote-units">
        You hold <b>{n === 1 ? "1 unit" : `${n} units`}</b> that{" "}
        {n === 1 ? "has" : "have"} not voted:{" "}
        {p.unvoted.map((u) => `Unit ${u}`).join(", ")}.
        {n === 2 ? " Both vote together." : n > 2 ? " All vote together." : ""}
      </p>
      <div className="vote-buttons">
        {voting === p.id ? (
          <>
            <button className="btn" type="button" aria-disabled="true">
              <span className="spinner" aria-hidden="true"></span>Waiting for
              your wallet…
            </button>
            <button
              className="btn"
              data-variant="outline"
              type="button"
              aria-disabled="true"
            >
              Vote against
            </button>
          </>
        ) : (
          <>
            <button className="btn" type="submit" name="inFavour" value="true">
              Vote for
            </button>
            <button
              className="btn"
              data-variant="outline"
              type="submit"
              name="inFavour"
              value="false"
            >
              Vote against
            </button>
          </>
        )}
      </div>
      <p className="field-hint">
        Your wallet will ask you to sign. Kaitiaki never sees your key.
      </p>
    </form>
  );
}

function ProposalCard({
  proposal: p,
  canAct,
  voting,
  onVote,
}: {
  proposal: Proposal;
  canAct: boolean;
  voting?: bigint;
  onVote?: OnVote;
}) {
  const work = p.kind === "Work";
  return (
    <article className="card proposal">
      <div className="proposal-top">
        <span className="proposal-id">#{String(p.id)}</span>
        <span className="badge" data-variant="secondary">
          {work ? "Work" : "Admit vendor"}
        </span>
        <span className="status" data-tone={TONE[p.state]}>
          {p.state}
        </span>
      </div>
      <h3 className="proposal-title">
        <a href={`#/proposal/${p.id}`}>
          {work ? p.description : `Admit ${p.description}`}
        </a>
      </h3>
      <dl className="meta">
        {work ? (
          <>
            <div>
              <dt>Spending cap</dt>
              <dd>{nzd(p.limit)}</dd>
            </div>
            <div>
              <dt>Pays from</dt>
              <dd>
                <span className="fund-tag" data-fund={FUNDS[Number(p.fund)][0]}>
                  {FUNDS[Number(p.fund)][1]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                <Address value={p.payee} />
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Adds vendor</dt>
              <dd>{p.description}</dd>
            </div>
            <div>
              <dt>Vendor wallet</dt>
              <dd>
                <Address value={p.payee} />
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="next">
        <span>
          {p.closes !== undefined && (
            <>
              <strong>Voting closes {date(p.closes)}.</strong>{" "}
            </>
          )}
          {String(p.forVotes)} for · {String(p.againstVotes)} against
        </span>
      </div>
      {p.canVote && canAct && (
        <VoteControl proposal={p} voting={voting} onVote={onVote} />
      )}
    </article>
  );
}

export function Home({
  funds,
  queued,
  proposals,
  ownUnits,
  canAct,
  voting,
  onVote,
  children,
}: {
  funds: View["funds"];
  queued: View["queued"];
  proposals: Proposal[];
  ownUnits: View["ownUnits"];
  // False when the wallet is on another chain: no vote is offered.
  canAct: boolean;
  voting?: bigint;
  onVote?: OnVote;
  // The wallet's Screen 8 state, if any.
  children?: ReactNode;
}) {
  const balances = [funds.operating, funds.maintenance];
  const queuedToPay = [queued.operating, queued.maintenance];
  const needVote = proposals.filter((p) => p.canVote);
  const others = proposals.filter((p) => !p.canVote);
  const card = (p: Proposal) => (
    <ProposalCard
      key={String(p.id)}
      proposal={p}
      canAct={canAct}
      voting={voting}
      onVote={onVote}
    />
  );
  return (
    <>
      <PageHead title="Home">
        <Guarantees />
      </PageHead>
      {children}
      <section aria-labelledby="h-funds">
        <div className="section-head">
          <h2 id="h-funds">The building’s money</h2>
          <span className="muted-text">Two funds. They never mix.</span>
        </div>
        <div className="grid-2">
          {FUNDS.map(([fund, name, description], i) => (
            <section
              key={fund}
              className="card fund"
              data-fund={fund}
              aria-label={`${name} fund`}
            >
              <div className="card-header">
                <h3 className="card-title">{name}</h3>
                <p className="card-description">{description}</p>
              </div>
              <div className="card-content">
                <p className="fund-balance">{nzd(balances[i])}</p>
                <p className="fund-meta">
                  <span>
                    Queued to pay, at most:{" "}
                    <b className="num">
                      {queuedToPay[i] ? nzd(queuedToPay[i]) : "none"}
                    </b>
                  </span>
                </p>
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="grid-main">
        <section aria-labelledby="h-vote">
          <div className="section-head">
            <h2 id="h-vote">Needs your vote</h2>
            <span className="muted-text">
              {needVote.length === 1
                ? "1 proposal"
                : `${needVote.length} proposals`}
            </span>
          </div>
          {needVote.length ? (
            needVote.map(card)
          ) : (
            <div className="empty">
              <h3>Nothing needs your vote.</h3>
            </div>
          )}
        </section>
        <section aria-labelledby="h-units">
          <div className="section-head">
            <h2 id="h-units">Your levies</h2>
            <a href="#/units">Your units</a>
          </div>
          {ownUnits.length > 0 && (
            <div className="card">
              <div
                className="card-content stack"
                style={{ paddingTop: "var(--space-6)" }}
              >
                {ownUnits.map((u, i) => (
                  <Fragment key={String(u.unitId)}>
                    {i > 0 && <hr className="separator" />}
                    <div className="own-unit">
                      <div className="row">
                        <h3 className="card-title">Unit {String(u.unitId)}</h3>
                        <span
                          className="status"
                          data-tone={u.status === "current" ? "ok" : "late"}
                        >
                          {u.status}
                        </span>
                      </div>
                      {u.overdue.length === 0 && (
                        <p className="muted-text">No overdue charges.</p>
                      )}
                      {u.overdue.map((c) => (
                        <div key={String(c.chargeId)} className="charge">
                          <div>
                            <p className="charge-amount">{nzd(c.amount)}</p>
                            <p
                              className="field-hint"
                              style={{ color: "var(--foreground)" }}
                            >
                              Charge #{String(c.chargeId)} · was due{" "}
                              {date(c.dueDate)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      <section aria-labelledby="h-all">
        <div className="section-head">
          <h2 id="h-all">Other proposals</h2>
        </div>
        {others.length ? (
          <div className="grid-2">{others.map(card)}</div>
        ) : (
          <div className="empty">
            <h3>No other proposals</h3>
            <p>
              The management firm proposes work and vendors. Owners then vote.
              New proposals will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
