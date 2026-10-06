// Screen 1, Home (`#/`): the two funds and the proposals. Until #151 fills
// it, a proposal the viewer can vote on carries its VoteControl here.
import { type FormEvent, type ReactNode } from "react";

import { nzd } from "../format.js";
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
  proposals,
  canAct,
  voting,
  onVote,
  children,
}: {
  funds: View["funds"];
  proposals: Proposal[];
  // False when the wallet is on another chain: no vote is offered.
  canAct: boolean;
  voting?: bigint;
  onVote?: OnVote;
  // The wallet's Screen 8 state, if any.
  children?: ReactNode;
}) {
  const balances = [funds.operating, funds.maintenance];
  return (
    <>
      <PageHead title="Home" />
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
              </div>
            </section>
          ))}
        </div>
      </section>
      <section aria-labelledby="h-proposals">
        <div className="section-head">
          <h2 id="h-proposals">Proposals</h2>
        </div>
        {proposals.length ? (
          <div className="grid-2">
            {proposals.map((p) => (
              <ProposalCard
                key={String(p.id)}
                proposal={p}
                canAct={canAct}
                voting={voting}
                onVote={onVote}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No proposals yet</h3>
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
