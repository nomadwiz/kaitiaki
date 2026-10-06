// Screen 2, Proposal (`#/proposal/<n>`): where a proposal is in its life, what
// it buys, the tally and quorum so far, and the viewer's vote (#152). It is
// the only screen that offers a vote.
import type { FormEvent } from "react";

import { date } from "../format.js";
import { PageHead } from "../shell.js";
import { ProposalMeta, TONE, type Proposal as ProposalView } from "./home.js";

type OnVote = (proposalId: bigint, inFavour: boolean) => void;

function Timeline({ steps }: { steps: ProposalView["steps"] }) {
  return (
    <ol className="timeline" aria-label="Proposal lifecycle">
      {steps.map((s) => (
        <li key={s.name} data-step={s.step}>
          <span className="t-name">{s.name}</span>
          {s.date !== undefined && (
            <span className="t-date">
              {s.dateLabel && `${s.dateLabel} `}
              {date(s.date)}
            </span>
          )}
          <span className="t-note">{s.note}</span>
        </li>
      ))}
    </ol>
  );
}

function Row({
  label,
  count,
  of,
  unit,
  met,
}: {
  label: string;
  count: bigint | number;
  of: bigint | number;
  unit: string;
  met: boolean;
}) {
  const share = of ? Math.min(100, (Number(count) * 100) / Number(of)) : 0;
  return (
    <div className="quorum-row">
      <div className="quorum-head">
        <span>{label}</span>
        <span>
          <b>
            {String(count)} of {String(of)}
          </b>{" "}
          {unit} ·{" "}
          <span className="status" data-tone={met ? "ok" : "wait"}>
            {met ? "met" : "not yet met"}
          </span>
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Number(of)}
        aria-valuenow={Number(count)}
        data-met={met ? "" : undefined}
      >
        <span style={{ width: `${share}%` }}></span>
      </div>
    </div>
  );
}

function Vote({ proposal: p }: { proposal: ProposalView }) {
  const q = p.quorum;
  return (
    <>
      <div className="tally" aria-label="Votes in units">
        <div className="tally-side">
          <span>For</span>
          <b>{String(p.forVotes)}</b>
          <span>units</span>
        </div>
        <div className="tally-side">
          <span>Against</span>
          <b>{String(p.againstVotes)}</b>
          <span>units</span>
        </div>
        <p className="tally-rule">
          Passes when more units vote for than against. A tie fails. One unit,
          one vote.
        </p>
      </div>
      {p.waived ? (
        <div className="quorum">
          <p className="quorum-waived">
            <b>Quorum waived.</b> Too few owners voted in the first 14 days, so
            voting was extended 7 days and quorum no longer applies. One owner’s
            vote can decide. This is deliberate and lawful.
          </p>
        </div>
      ) : (
        <div className="quorum" aria-label="Quorum">
          <Row
            label="Units voted (25% of the building)"
            count={q.unitsVoted}
            of={q.unitsNeeded}
            unit="units"
            met={q.unitsMet}
          />
          <Row
            label="Different owners voted"
            count={q.voters}
            of={q.votersNeeded}
            unit="owners"
            met={q.votersMet}
          />
          <p className="field-hint">
            Both are needed.
            {p.state === "Open" &&
              ` If quorum is not met by ${date(p.closes!)}, voting extends 7 days and quorum is waived.`}
          </p>
        </div>
      )}
    </>
  );
}

function VoteControl({
  proposal: p,
  voting,
  onVote,
}: {
  proposal: ProposalView;
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

export function Proposal({
  id,
  proposal: p,
  canAct,
  voting,
  onVote,
}: {
  id: string;
  // Undefined when the log holds no such proposal.
  proposal?: ProposalView;
  // False when the wallet is on another chain: no vote is offered.
  canAct: boolean;
  voting?: bigint;
  onVote?: OnVote;
}) {
  if (!p) {
    return (
      <>
        <PageHead title={`Proposal #${id}`} />
        <p>There is no proposal #{id}.</p>
      </>
    );
  }
  const next =
    p.closes !== undefined && `Next date: voting closes ${date(p.closes)}.`;
  return (
    <>
      <PageHead
        title={p.kind === "Work" ? p.description : `Admit ${p.description}`}
      >
        <div className="row">
          <span className="proposal-id">Proposal #{String(p.id)}</span>
          <span className="status" data-tone={TONE[p.state]}>
            {p.state}
          </span>
          <span className="muted-text">
            Proposed by the firm on {date(p.createdAt)}
          </span>
        </div>
      </PageHead>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Where it is</h2>
          {next && <p className="card-description">{next}</p>}
        </div>
        <div className="card-content">
          <Timeline steps={p.steps} />
        </div>
      </section>
      <div className="grid-main">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">What it buys</h2>
            <p className="card-description">{p.description}</p>
          </div>
          <div className="card-content">
            <ProposalMeta proposal={p} withQuote />
          </div>
        </section>
        <section className="card" aria-labelledby="h-v">
          <div className="card-header">
            <h2 className="card-title" id="h-v">
              The vote
            </h2>
          </div>
          <div className="card-content stack" style={{ gap: "var(--space-6)" }}>
            <Vote proposal={p} />
            {p.canVote && canAct && (
              <>
                <hr className="separator" />
                <VoteControl proposal={p} voting={voting} onVote={onVote} />
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
