// The firm's Home (`#/`, #182), composed from doc/asset/mockups/FirmHome:
// what the building waits on the firm for. It offers no action: Levies to
// collect links to Collect levies, and each proposal to its own screen,
// where Confirm work and Carry out are (interface.md §4.2). Charges appear
// as a count and a date, with no unit or amount (NFR10).
import { Banknote, ClipboardCheck, HandCoins, Plus, Store } from "lucide-react";
import type { ReactNode } from "react";

import { quorumConditions, RulesPopover, StatusBadge } from "../components/kaitiaki.js";
import { Button, buttonVariants } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "../components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { date, nzd, title } from "../format.js";
import { cn } from "../lib/utils.js";
import type { View } from "../view.js";
import { Heading, meta, rows } from "./home.js";

export const READY_RULES = [
  "Carrying out a work proposal pays the vendor, up to its limit.",
  "Carrying out an Admit vendor proposal adds the vendor to the approved list.",
] as const;

// One row: the whole row links to the proposal, and its action label is
// not a second control.
function Row({
  id,
  name,
  details,
  action,
}: {
  id: bigint;
  name: string;
  details: ReactNode;
  action: ReactNode;
}) {
  return (
    <li>
      <a
        href={`#/proposal/${id}`}
        className="flex flex-wrap items-center justify-between gap-3 text-inherit no-underline"
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{name}</span>
          <span className={meta}>{details}</span>
        </span>
        {action}
      </a>
    </li>
  );
}

function List({ empty, children }: { empty: string; children: ReactNode[] }) {
  return children.length ? (
    <ul className={rows}>{children}</ul>
  ) : (
    <p className="font-semibold">{empty}</p>
  );
}

export function FirmHome({
  toCollect,
  toConfirm,
  proposals,
}: {
  toCollect: View["toCollect"];
  toConfirm: View["toConfirm"];
  proposals: View["proposals"];
}) {
  const due = toCollect.filter((c) => c.due);
  const oldest = due.reduce<bigint | undefined>(
    (min, c) => (min === undefined || c.dueDate < min ? c.dueDate : min),
    undefined,
  );
  const ready = proposals.filter((p) => p.act === "execute");
  const voting = proposals.filter(
    (p) => p.state === "Open" || p.state === "Extended",
  );
  const label = (variant: "default" | "outline", icon: ReactNode, text: string) => (
    <span className={buttonVariants({ variant })}>
      {icon}
      {text}
    </span>
  );
  return (
    <>
      <h1>Home</h1>
      <div className="grid items-start gap-6 wide:grid-cols-3">
        <Card
          role="region"
          aria-labelledby="h-collect"
          className={cn(oldest !== undefined && "border-2 border-primary")}
        >
          <CardHeader>
            <Heading id="h-collect">Levies to collect</Heading>
            <CardDescription>
              {oldest === undefined
                ? "No charge is due."
                : due.length === 1
                  ? `1 charge is due. It fell due on ${date(oldest)}.`
                  : `${due.length} charges are due. The oldest fell due on ${date(oldest)}.`}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <a href="#/collect" className="no-underline">
                <HandCoins aria-hidden="true" />
                Collect levies
              </a>
            </Button>
          </CardFooter>
        </Card>
        <Card role="region" aria-labelledby="h-confirm">
          <CardHeader>
            <Heading id="h-confirm">Work to confirm</Heading>
          </CardHeader>
          <CardContent>
            <List empty="No work is waiting to be confirmed.">
              {toConfirm.map((w) => (
                <Row
                  key={String(w.id)}
                  id={w.id}
                  name={w.title}
                  details={
                    <>
                      <span>{w.vendor}</span>
                      <span>
                        Wait {w.due ? "ended" : "ends"} {date(w.eta)}
                      </span>
                    </>
                  }
                  action={
                    w.due ? (
                      label("default", <ClipboardCheck aria-hidden="true" />, "Confirm work")
                    ) : (
                      <StatusBadge word="Queued" />
                    )
                  }
                />
              ))}
            </List>
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="h-ready">
          <CardHeader>
            <Heading id="h-ready">Ready to carry out</Heading>
            <CardAction>
              <RulesPopover rules={READY_RULES} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <List empty="Nothing is ready to carry out.">
              {ready.map((p) => {
                const work = p.kind === "Work";
                const confirmed = p.steps.find(
                  (s) => s.dateLabel === "Confirmed",
                )?.date;
                return (
                  <Row
                    key={String(p.id)}
                    id={p.id}
                    name={title(p)}
                    details={
                      work ? (
                        <>
                          <span>Work confirmed {date(confirmed!)}</span>
                          <span className="tabular-nums">Up to {nzd(p.limit)}</span>
                        </>
                      ) : (
                        <span>Wait ended {date(p.eta!)}</span>
                      )
                    }
                    action={label(
                      "outline",
                      work ? <Banknote aria-hidden="true" /> : <Store aria-hidden="true" />,
                      "Carry out",
                    )}
                  />
                );
              })}
            </List>
          </CardContent>
        </Card>
      </div>
      <Card role="region" aria-labelledby="h-voting">
        <CardHeader>
          <Heading id="h-voting">Your proposals in voting</Heading>
          <CardAction>
            <Button variant="outline" asChild>
              <a href="#/propose" className="text-foreground no-underline">
                <Plus aria-hidden="true" />
                Propose work
              </a>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {voting.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Quorum</TableHead>
                  <TableHead>Closes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {voting.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell>
                      <a href={`#/proposal/${p.id}`}>{title(p)}</a>
                    </TableCell>
                    <TableCell>
                      <StatusBadge word={p.state} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.waived ? (
                        <span className="font-semibold whitespace-normal text-warning">
                          Quorum waived. One owner's vote can decide.
                        </span>
                      ) : (
                        <span className="flex flex-col gap-1">
                          {quorumConditions(p.quorum).map(([label, , , words, met]) => (
                            <span key={label} className="flex items-center gap-2">
                              {words}
                              <StatusBadge word={met ? "met" : "not yet met"} />
                            </span>
                          ))}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{date(p.closes!)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="font-semibold">
              No proposals are open for voting.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
