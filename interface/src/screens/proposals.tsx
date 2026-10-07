// Proposals (`#/proposals`, #177), composed from doc/asset/mockups/Proposals,
// in both workspaces: every proposal under Voting, Waiting to pay or Closed,
// each card linking to its screen. The owner's copy names the viewer's units
// that have not voted; the firm's links to Propose work and to Vendors.
import { Plus, Store, TriangleAlert } from "lucide-react";

import { Fund, QuorumMeter, StatusBadge } from "../components/kaitiaki.js";
import { Alert, AlertTitle } from "../components/ui/alert.js";
import { Badge } from "../components/ui/badge.js";
import { Button, buttonVariants } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.js";
import { date, nzd, short, title, unitsLabel } from "../format.js";
import type { Workspace } from "../shell.js";
import type { View } from "../view.js";

type Proposal = View["proposals"][number];

// Each tab and the states it holds. Passed and Queued wait for Queue, the
// wait and, for Work, the firm's confirmation before anything is paid.
const GROUPS = [
  ["voting", "Voting", ["Open", "Extended"], "No proposals are open for voting."],
  ["waiting", "Waiting to pay", ["Passed", "Queued"], "No proposals are waiting to pay."],
  ["closed", "Closed", ["Failed", "Executed"], "No proposals are closed."],
] as const;

// The date of what happens next, or of how it ended.
function next(p: Proposal) {
  const at = (name: string) => p.steps.find((s) => s.name === name)?.date;
  const confirmed = p.steps.find((s) => s.dateLabel === "Confirmed")?.date;
  switch (p.state) {
    case "Open":
    case "Extended":
      return `Closes ${date(p.closes!)}`;
    case "Passed":
    case "Failed":
      return `Voting closed ${date(at(p.state)!)}`;
    case "Queued": {
      if (confirmed !== undefined) return `Work confirmed ${date(confirmed)}`;
      const waiting = p.steps.find((s) => s.name === "Queued")!.step === "current";
      return `Wait ${waiting ? "ends" : "ended"} ${date(at("Queued")!)}`;
    }
    case "Executed":
      return `Carried out ${date(at("Executed")!)}`;
  }
}

function ProposalCard({
  proposal: p,
  workspace,
}: {
  proposal: Proposal;
  workspace: Workspace;
}) {
  const work = p.kind === "Work";
  const vote = workspace === "owner" && p.canVote;
  return (
    <Card className="relative">
      <CardHeader>
        <span className="flex flex-wrap gap-2">
          <StatusBadge word={p.state} />
          <Badge variant="outline">{work ? "Work" : "Admit vendor"}</Badge>
        </span>
        <CardTitle>
          <h2 className="text-xl">
            {/* Stretched over the card, so the whole card opens it. */}
            <a
              href={`#/proposal/${p.id}`}
              className="text-foreground no-underline after:absolute after:inset-0 after:rounded-lg"
            >
              {title(p)}
            </a>
          </h2>
        </CardTitle>
        <CardAction>
          {/* Not a second link: the stretched title takes the press. */}
          <span className={buttonVariants({ variant: "outline" })}>
            {vote ? "Vote" : "View"}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground">
          {work ? (
            <>
              {/* A name is shown only when owners voted on it (ADR-018);
                  then the address and identifier, as every vendor appears. */}
              {p.vendor && <span>{p.vendor.name}</span>}
              <span className="font-mono text-[0.9375rem]">{short(p.payee)}</span>
              {p.vendor && <span>{p.vendor.companyId}</span>}
              <span className="tabular-nums">Up to {nzd(p.limit)}</span>
              <Fund fund={p.fund} />
            </>
          ) : (
            <>
              <span>{p.companyId}</span>
              <span className="font-mono text-[0.9375rem]">{short(p.payee)}</span>
            </>
          )}
          <span>{next(p)}</span>
        </span>
        {p.state === "Open" && <QuorumMeter quorum={p.quorum} />}
        {p.state === "Extended" && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Quorum waived. One owner's vote can decide.</AlertTitle>
          </Alert>
        )}
        {vote && (
          <span className="text-base font-semibold">
            {unitsLabel(p.unvoted)} {p.unvoted.length === 1 ? "has" : "have"}{" "}
            not voted.
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export function Proposals({
  workspace,
  proposals,
}: {
  workspace: Workspace;
  proposals: Proposal[];
}) {
  const groups = GROUPS.map(([value, label, states, empty]) => ({
    value,
    label,
    empty,
    proposals: proposals.filter((p) =>
      (states as readonly string[]).includes(p.state),
    ),
  }));
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Proposals</h1>
        {workspace === "firm" && (
          <span className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="#/propose" className="no-underline">
                <Plus aria-hidden="true" />
                Propose work
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="#/vendors" className="text-foreground no-underline">
                <Store aria-hidden="true" />
                Propose a vendor
              </a>
            </Button>
          </span>
        )}
      </div>
      <Tabs defaultValue="voting" className="gap-6 wide:gap-8">
        <TabsList aria-label="Stage">
          {groups.map((g) => (
            <TabsTrigger key={g.value} value={g.value}>
              {g.label}
              <span className="font-medium text-muted-foreground tabular-nums">
                {g.proposals.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((g) => (
          // Every tab's cards are in the markup, so the tests read them all;
          // an inactive tab's are hidden.
          <TabsContent
            key={g.value}
            value={g.value}
            forceMount
            className="flex flex-col gap-4 data-[state=inactive]:hidden"
          >
            {g.proposals.length ? (
              g.proposals.map((p) => (
                <ProposalCard
                  key={String(p.id)}
                  proposal={p}
                  workspace={workspace}
                />
              ))
            ) : (
              <Card>
                <CardContent>
                  <p className="font-semibold">{g.empty}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
