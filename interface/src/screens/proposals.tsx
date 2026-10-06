// Proposals (`#/proposals`), until #177 rebuilds it from its mock-up: every
// proposal as a card linking to its screen, and Queue and Carry out, which
// #178 moves onto the proposal's timeline. The card, its meta and the state
// tones are shared with the Proposal screen.
import { date, nzd } from "../format.js";
import { Address, PageHead } from "../shell.js";
import type { View } from "../view.js";
import { Actions, type Acting, type OnAct } from "./actions.js";

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
              {/* A name is shown only when owners voted on it (ADR-018). */}
              {p.vendor && `${p.vendor.name} `}
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

export function ProposalCard({ proposal: p }: { proposal: Proposal }) {
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


export function Proposals({
  proposals,
  actions,
  onAct,
  acting,
}: {
  proposals: Proposal[];
  actions: View["actions"];
  onAct?: OnAct;
  acting?: Acting;
}) {
  return (
    <>
      <PageHead title="Proposals" />
      {proposals.length ? (
        <div className="grid-2">
          {proposals.map((p) => (
            <ProposalCard key={String(p.id)} proposal={p} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>No proposals yet</h3>
        </div>
      )}
      <Actions actions={actions} onAct={onAct} acting={acting} />
    </>
  );
}
