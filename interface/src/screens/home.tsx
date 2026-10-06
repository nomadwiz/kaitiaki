// The owner's Home (`#/`, #176), composed from doc/asset/mockups/OwnerHome:
// what needs the viewer's vote, their levies, what is queued to pay and the
// two funds. It offers no action: each proposal links to its own screen,
// where the vote is (interface.md §4.1).
import { CircleAlert, KeyRound } from "lucide-react";

import {
  Fund,
  FUND_NAMES,
  RulesPopover,
  StatusBadge,
} from "../components/kaitiaki.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Badge } from "../components/ui/badge.js";
import { buttonVariants, Button } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { date, nzd, short } from "../format.js";
import type { View } from "../view.js";

type Proposal = View["proposals"][number];

export const VOTE_RULES = [
  "Votes are public and cannot be changed.",
  "One vote counts for every unit you hold that has not voted.",
] as const;

export const LEVY_RULES = [
  "The management firm collects each charge from this wallet on its due date.",
  "A charge the wallet cannot cover stays owed and falls into arrears.",
  "A paid arrear stops showing anywhere.",
] as const;

const title = (p: Proposal) =>
  p.kind === "Work" ? p.description : `Admit ${p.description}`;
// A name is shown only when owners voted on it (ADR-018).
const vendor = (p: Proposal) => p.vendor?.name ?? short(p.payee);

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <CardTitle>
      <h2 id={id} className="text-xl">
        {children}
      </h2>
    </CardTitle>
  );
}

const rows = "flex flex-col [&>li]:border-t [&>li]:py-3.5 [&>li:first-child]:border-t-0 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0";
const meta = "flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground";

function VoteRow({ proposal: p }: { proposal: Proposal }) {
  return (
    <li>
      <a
        href={`#/proposal/${p.id}`}
        className="flex flex-wrap items-center justify-between gap-3 text-inherit no-underline"
      >
        <span className="flex flex-col gap-1.5">
          <span className="flex gap-2">
            <StatusBadge word={p.state} />
            <Badge variant="outline">
              {p.kind === "Work" ? "Work" : "Admit vendor"}
            </Badge>
          </span>
          <span className="font-semibold">{title(p)}</span>
          <span className={meta}>
            {p.kind === "Work" && (
              <>
                <span>{vendor(p)}</span>
                <span className="tabular-nums">Up to {nzd(p.limit)}</span>
                <Fund fund={p.fund} />
              </>
            )}
            {p.waived && (
              <span className="font-semibold text-warning">
                Quorum waived. One owner's vote can decide.
              </span>
            )}
            {p.closes !== undefined && <span>Closes {date(p.closes)}</span>}
          </span>
        </span>
        <span className={buttonVariants({ variant: "outline" })}>Vote</span>
      </a>
    </li>
  );
}

export function Home({
  funds,
  proposals,
  ownUnits,
}: {
  funds: View["funds"];
  proposals: Proposal[];
  ownUnits: View["ownUnits"];
}) {
  const needVote = proposals.filter((p) => p.canVote);
  // Queued Work proposals: each pays its vendor once the wait has ended and
  // the firm has confirmed the work.
  const queued = proposals.filter(
    (p) => p.state === "Queued" && p.kind === "Work",
  );
  const next = ownUnits
    .flatMap((u) => u.charges)
    .filter((c) => !c.overdue)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
  return (
    <>
      <h1>Home</h1>
      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="h-vote">
          <CardHeader>
            <Heading id="h-vote">Needs your vote</Heading>
            <CardAction>
              <RulesPopover rules={VOTE_RULES} />
            </CardAction>
          </CardHeader>
          <CardContent>
            {needVote.length ? (
              <ul className={rows}>
                {needVote.map((p) => (
                  <VoteRow key={String(p.id)} proposal={p} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No proposals are open for voting.
              </p>
            )}
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="h-levies">
          <CardHeader>
            <Heading id="h-levies">Your levies</Heading>
            <CardAction>
              <RulesPopover rules={LEVY_RULES} />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ownUnits
              .filter((u) => u.status === "in arrears")
              .map((u) => {
                const ids = u.charges
                  .filter((c) => c.overdue)
                  .map((c) => `#${c.chargeId}`);
                const one = ids.length === 1;
                return (
                  <Alert key={String(u.unitId)} variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>Unit {String(u.unitId)} is in arrears</AlertTitle>
                    <AlertDescription>
                      {one
                        ? `Charge ${ids[0]} was not covered when it was collected. Pay it to clear the arrear.`
                        : `Charges ${ids.slice(0, -1).join(", ")} and ${ids.at(-1)} were not covered when they were collected. Pay them to clear the arrear.`}
                    </AlertDescription>
                  </Alert>
                );
              })}
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-base">
              <dt className="text-muted-foreground">Next charge</dt>
              <dd className="text-right tabular-nums">
                {next
                  ? `${nzd(next.amount)} on ${date(next.dueDate)}`
                  : "None scheduled"}
              </dd>
            </dl>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <a href="#/units" className="text-foreground no-underline">
                <KeyRound aria-hidden="true" />
                Your units
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div className="grid items-start gap-6 wide:grid-cols-2">
        <Card role="region" aria-labelledby="h-queued">
          <CardHeader>
            <Heading id="h-queued">Queued to pay</Heading>
          </CardHeader>
          <CardContent>
            {queued.length ? (
              <ul className={rows}>
                {queued.map((p) => {
                  const eta = p.steps.find((s) => s.name === "Queued")?.date;
                  const confirmed = p.steps.find(
                    (s) => s.dateLabel === "Confirmed",
                  )?.date;
                  return (
                    <li key={String(p.id)} className="flex flex-col gap-1">
                      <a
                        href={`#/proposal/${p.id}`}
                        className="font-semibold text-inherit no-underline"
                      >
                        {title(p)}
                      </a>
                      <span className={meta}>
                        <span>{vendor(p)}</span>
                        <span>
                          {confirmed !== undefined
                            ? `Work confirmed ${date(confirmed)}`
                            : eta !== undefined &&
                              `Payment possible from ${date(eta)}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nothing is queued to pay.</p>
            )}
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="h-funds">
          <CardHeader>
            <Heading id="h-funds">The building's funds</Heading>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-lg">
              {[funds.operating, funds.maintenance].map((balance, i) => (
                <div key={FUND_NAMES[i]} className="contents">
                  <dt>
                    <Fund fund={BigInt(i)} />
                  </dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {nzd(balance)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
