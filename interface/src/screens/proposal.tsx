// Proposal (`#/proposal/<n>`, #178), composed from doc/asset/mockups/Proposal,
// in both workspaces: where the proposal is in its life, what owners are
// voting on, the votes, and what the viewer may do now. An owner votes;
// anyone queues and carries out once each date has arrived, which view.ts
// decides (FR22, NFR7); the firm confirms work. Each action is offered only
// when its handler is given, so the firm's copy, given no vote, offers none
// (ADR-021).
import {
  BadgeCheck,
  Banknote,
  Check,
  ClipboardCheck,
  ListPlus,
  TriangleAlert,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import {
  Address,
  Fund,
  FUND_NAMES,
  LifecycleTimeline,
  QuorumMeter,
  RulesPopover,
  StatusBadge,
} from "../components/kaitiaki.js";
import { Alert, AlertTitle } from "../components/ui/alert.js";
import { Badge } from "../components/ui/badge.js";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb.js";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { date, nzd, short, unitsLabel } from "../format.js";
import { cn } from "../lib/utils.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
import { checkEvidence, type FirmActs } from "./firm.js";

type ProposalView = View["proposals"][number];

export type Act = "queue" | "execute";
// The write the wallet is signing. The firm's four and an owner's direct
// debit share the lock. A proposal being created has no number yet, and a
// collection or a direct debit names several charges, so their `id` is 0.
export type Acting = {
  action: Act | "work" | "vendor" | "confirm" | "collect" | "debit";
  id: bigint;
};
export type OnAct = (action: Act, id: bigint) => void;
type OnVote = (proposalId: bigint, inFavour: boolean) => void;

const CONFIRM_RULES = [
  "Confirming records the hash of the completion evidence. The evidence stays off the chain.",
  "Payment follows when you carry out the proposal.",
] as const;

export const votesRules = (p: ProposalView) => [
  "Passes when more units vote for than against. A tie fails.",
  `Quorum needs both: ${p.quorum.unitsNeeded} of the building's ${p.units} units, and ${p.quorum.votersNeeded} different owners.`,
  "If quorum is not met when voting closes, voting extends 7 days and quorum is waived.",
  "Anyone in the building may queue a passed proposal.",
];

const title = (p: ProposalView) =>
  p.kind === "Work" ? p.description : `Admit ${p.description}`;

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <CardTitle>
      <h2 id={id} className="text-xl">
        {children}
      </h2>
    </CardTitle>
  );
}

function Signed() {
  return (
    <span className="flex items-center gap-2 text-base text-muted-foreground">
      <Wallet aria-hidden="true" className="size-4" />
      Signed in your wallet.
    </span>
  );
}

// A card in the actions column: its title, a line of data or a date, and,
// when an action is offered, the action with "Signed in your wallet." below.
function ActionCard({
  id,
  heading,
  line,
  rules,
  emphasis,
  children,
}: {
  id: string;
  heading: string;
  line: string;
  rules?: readonly string[];
  emphasis?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card
      role="region"
      aria-labelledby={id}
      className={cn(emphasis && "border-2 border-primary")}
    >
      <CardHeader>
        <Heading id={id}>{heading}</Heading>
        <CardDescription>{line}</CardDescription>
        {rules && (
          <CardAction>
            <RulesPopover rules={rules} />
          </CardAction>
        )}
      </CardHeader>
      {children && (
        <>
          <CardContent>{children}</CardContent>
          <CardFooter>
            <Signed />
          </CardFooter>
        </>
      )}
    </Card>
  );
}

// What owners are voting on: the vendor by name, then its address and
// company identifier; for Work, the cap, the fund and the quote's hash.
function Facts({ proposal: p }: { proposal: ProposalView }) {
  const work = p.kind === "Work";
  // A name is shown only when owners voted on it (ADR-018).
  const name = work ? p.vendor?.name : p.description;
  const companyId = work ? p.vendor?.companyId : p.companyId;
  const row = (term: string, value: ReactNode) => (
    <div key={term} className="contents">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
  return (
    <dl className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)] gap-x-5 gap-y-3.5 text-base max-wide:grid-cols-[minmax(0,88px)_minmax(0,1fr)] max-wide:gap-x-3">
      {row(
        "Vendor",
        <span className="flex flex-col gap-1">
          {name && <span className="font-semibold">{name}</span>}
          <Address value={p.payee} />
          {companyId && (
            <span className="text-muted-foreground">{companyId}</span>
          )}
        </span>,
      )}
      {work && (
        <>
          {row(
            "Limit",
            <span className="text-lg font-semibold tabular-nums">
              {nzd(p.limit)}
            </span>,
          )}
          {row("Paid from", <Fund fund={p.fund} />)}
          {row("Quote", <Address value={p.quoteHash} label="Copy quote hash" />)}
        </>
      )}
      {row("Proposed", `${date(p.createdAt)}, by the management firm`)}
    </dl>
  );
}

function Votes({ proposal: p }: { proposal: ProposalView }) {
  const met = p.quorum.unitsMet && p.quorum.votersMet;
  return (
    <Card role="region" aria-labelledby="h-votes">
      <CardHeader>
        <Heading id="h-votes">Votes</Heading>
        <CardAction className="flex items-center gap-2">
          {!p.waived && <StatusBadge word={met ? "met" : "not yet met"} />}
          <RulesPopover rules={votesRules(p)} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {p.waived ? (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Quorum waived. One owner's vote can decide.</AlertTitle>
          </Alert>
        ) : (
          <QuorumMeter quorum={p.quorum} />
        )}
        <dl className="grid grid-cols-2 gap-3" aria-label="Votes in units">
          {(
            [
              ["For", p.forVotes],
              ["Against", p.againstVotes],
            ] as const
          ).map(([side, units]) => (
            <div key={side} className="rounded-lg border px-4 py-3.5">
              <dt className="text-base text-muted-foreground">{side}</dt>
              <dd>
                <span className="text-2xl font-semibold tabular-nums">
                  {String(units)}
                </span>{" "}
                <span className="text-base">units</span>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// VoteControl: every unit of the viewer's that has not voted votes at once,
// through the form's two submit buttons.
function YourVote({
  proposal: p,
  voting,
  onVote,
}: {
  proposal: ProposalView;
  voting?: bigint;
  onVote: OnVote;
}) {
  const units = unitsLabel(p.unvoted);
  const one = p.unvoted.length === 1;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const button = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    onVote(p.id, button.value === "true");
  };
  const signing = voting === p.id;
  return (
    <Card
      role="region"
      aria-labelledby="h-your-vote"
      className="border-2 border-primary"
    >
      <CardHeader>
        <Heading id="h-your-vote">Your vote</Heading>
        <CardDescription>
          {units} {one ? "has" : "have"} not voted.
        </CardDescription>
        <CardAction>
          <RulesPopover
            rules={[
              `One vote counts for ${units}${one ? "" : " together"}.`,
              "Your vote is public and cannot be changed.",
            ]}
          />
        </CardAction>
      </CardHeader>
      <form className="vote" data-proposal={String(p.id)} onSubmit={submit}>
        <CardContent className="flex flex-col gap-3">
          {signing ? (
            <>
              <Button size="lg" type="button" aria-disabled="true">
                <Waiting />
              </Button>
              <Button size="lg" variant="outline" type="button" aria-disabled="true">
                <X aria-hidden="true" />
                Vote against
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" type="submit" name="inFavour" value="true">
                <Check aria-hidden="true" />
                Vote for
              </Button>
              <Button
                size="lg"
                variant="outline"
                type="submit"
                name="inFavour"
                value="false"
              >
                <X aria-hidden="true" />
                Vote against
              </Button>
            </>
          )}
        </CardContent>
      </form>
      <CardFooter>
        <Signed />
      </CardFooter>
    </Card>
  );
}

// Confirm work: the firm's, once the 7-day wait has ended. A malformed hash
// is caught before anything is sent.
function ConfirmWork({
  proposal: p,
  onConfirm,
  acting,
}: {
  proposal: ProposalView;
  onConfirm: FirmActs["onConfirm"];
  acting?: Acting;
}) {
  const [hint, setHint] = useState<string>();
  const busy = acting !== undefined;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const evidence = String(new FormData(e.currentTarget).get("evidence"));
    const failed = checkEvidence(evidence);
    setHint(failed);
    if (!failed) onConfirm(p.id, evidence);
  };
  return (
    <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
      <label htmlFor="evidence" className="text-base font-semibold">
        Evidence hash
      </label>
      <Input
        id="evidence"
        name="evidence"
        className="font-mono"
        placeholder="0x…"
        aria-invalid={hint ? true : undefined}
        aria-describedby={hint ? "evidence-e" : undefined}
      />
      {hint && (
        <p id="evidence-e" className="text-base text-destructive">
          {hint}
        </p>
      )}
      <Button size="lg" type="submit" aria-disabled={busy || undefined}>
        {acting?.action === "confirm" && acting.id === p.id ? (
          <Waiting />
        ) : (
          <>
            <ClipboardCheck aria-hidden="true" />
            Confirm work
          </>
        )}
      </Button>
    </form>
  );
}

export function Proposal({
  id,
  proposal: p,
  voting,
  onVote,
  onAct,
  acting,
  onConfirm,
}: {
  id: string;
  // Undefined when the log holds no such proposal.
  proposal?: ProposalView;
  voting?: bigint;
  // Each action is offered only when its handler is given: none on the
  // wrong chain, and Confirm work only to the firm's wallet.
  onVote?: OnVote;
  onAct?: OnAct;
  acting?: Acting;
  onConfirm?: FirmActs["onConfirm"];
}) {
  const crumbs = (page: string) => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#/proposals">Proposals</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
  if (!p) {
    return (
      <>
        {crumbs(`Proposal #${id}`)}
        <h1>Proposal #{id}</h1>
        <p>There is no proposal #{id}.</p>
      </>
    );
  }
  const work = p.kind === "Work";
  const open = p.state === "Open" || p.state === "Extended";
  const busy = acting !== undefined;
  // Queue or Carry out, the one being signed waiting on the wallet.
  const press = (action: Act, label: string, Icon: LucideIcon) =>
    onAct && (
      <Button
        size="lg"
        type="button"
        className="w-full"
        aria-disabled={busy || undefined}
        onClick={busy ? undefined : () => onAct(action, p.id)}
      >
        {acting?.action === action && acting.id === p.id ? (
          <Waiting />
        ) : (
          <>
            <Icon aria-hidden="true" />
            {label}
          </>
        )}
      </Button>
    );
  // Work the firm has yet to confirm, whose card the firm's copy shows.
  const confirming =
    onConfirm && work && p.state === "Queued" && p.act !== "execute";
  const vendor = p.vendor?.name ?? short(p.payee);
  return (
    <>
      {crumbs(title(p))}
      <div className="flex flex-col gap-3">
        <span className="flex flex-wrap gap-2">
          <StatusBadge word={p.state} />
          <Badge variant="outline">{work ? "Work" : "Admit vendor"}</Badge>
          {work && (
            <Badge variant="outline">
              <Fund fund={p.fund} />
            </Badge>
          )}
        </span>
        <h1>{title(p)}</h1>
      </div>
      <Card role="region" aria-label="Where this proposal is">
        <CardContent>
          <LifecycleTimeline steps={p.steps} />
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card role="region" aria-labelledby="h-facts">
            <CardHeader>
              <Heading id="h-facts">What owners are voting on</Heading>
            </CardHeader>
            <CardContent>
              <Facts proposal={p} />
            </CardContent>
          </Card>
          <Votes proposal={p} />
        </div>
        <div className="flex flex-col gap-6">
          {p.canVote && onVote && (
            <YourVote proposal={p} voting={voting} onVote={onVote} />
          )}
          {open && (
            <ActionCard
              id="h-after"
              heading="After voting closes"
              line={`If it passes, Queue for payment appears here on ${date(p.closes!)}.`}
            />
          )}
          {p.state === "Passed" && (
            <ActionCard
              id="h-queue"
              heading="Queue for payment"
              line={`Voting closed on ${date(p.steps.find((s) => s.name === "Passed")!.date!)}.`}
            >
              {press("queue", "Queue for payment", ListPlus)}
            </ActionCard>
          )}
          {confirming && (
            <ActionCard
              id="h-confirm"
              heading="Confirm the work"
              line={
                p.act === "confirm"
                  ? `The 7-day wait ended on ${date(p.eta!)}.`
                  : `Confirm work appears here on ${date(p.eta!)}.`
              }
              rules={CONFIRM_RULES}
              emphasis
            >
              {p.act === "confirm" && (
                <ConfirmWork proposal={p} onConfirm={onConfirm} acting={acting} />
              )}
            </ActionCard>
          )}
          {p.state === "Queued" &&
            (work ? (
              <ActionCard
                id="h-carry"
                heading={
                  confirming ? "Then carry out the payment" : "Carry out the payment"
                }
                line={`Pays ${vendor} up to ${nzd(p.limit)} from ${FUND_NAMES[Number(p.fund)]}.`}
              >
                {p.act === "execute" &&
                  press("execute", "Carry out payment", Banknote)}
              </ActionCard>
            ) : (
              <ActionCard
                id="h-carry"
                heading="Admit the vendor"
                line={
                  p.act === "execute"
                    ? `Adds ${p.description} to the approved vendors.`
                    : `Carry out appears here on ${date(p.eta!)}.`
                }
              >
                {p.act === "execute" && press("execute", "Carry out", BadgeCheck)}
              </ActionCard>
            ))}
        </div>
      </div>
    </>
  );
}
