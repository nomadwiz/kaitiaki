// Screen 1, Home (`#/`): the two funds, what needs the viewer's vote, their
// levies and the four guarantees. It offers no action: each proposal links to
// its own screen, where the vote is.
import { Fragment, type ReactNode } from "react";

import { date, nzd } from "../format.js";
import { Address, PageHead } from "../shell.js";
import type { View } from "../view.js";

export type Proposal = View["proposals"][number];

export const TONE = {
  Open: "info",
  Extended: "wait",
  Passed: "ok",
  Failed: "fail",
  Queued: "wait",
  Executed: "done",
} as const;

export const FUNDS = [
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

// What a proposal buys, from where, and from whom.
export function ProposalMeta({
  proposal: p,
  withQuote,
}: {
  proposal: Proposal;
  // The Proposal screen adds the hash of the quote.
  withQuote?: boolean;
}) {
  const work = p.kind === "Work";
  return (
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
          {withQuote && (
            <div>
              <dt>Quote hash</dt>
              <dd>
                <Address value={p.quoteHash} label="Copy quote hash" />
              </dd>
            </div>
          )}
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
  );
}

function ProposalCard({ proposal: p }: { proposal: Proposal }) {
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
      <ProposalMeta proposal={p} />
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
    </article>
  );
}

export function Home({
  funds,
  queued,
  proposals,
  ownUnits,
  children,
}: {
  funds: View["funds"];
  queued: View["queued"];
  proposals: Proposal[];
  ownUnits: View["ownUnits"];
  // The wallet's Screen 8 state, if any.
  children?: ReactNode;
}) {
  const balances = [funds.operating, funds.maintenance];
  const queuedToPay = [queued.operating, queued.maintenance];
  const needVote = proposals.filter((p) => p.canVote);
  const others = proposals.filter((p) => !p.canVote);
  const card = (p: Proposal) => (
    <ProposalCard key={String(p.id)} proposal={p} />
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
        {ownUnits.length > 0 && (
          <section aria-labelledby="h-units">
            <div className="section-head">
              <h2 id="h-units">Your levies</h2>
              <a href="#/units">Your units</a>
            </div>
            {
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
                          <h3 className="card-title">
                            Unit {String(u.unitId)}
                          </h3>
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
            }
          </section>
        )}
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
