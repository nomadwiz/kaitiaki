// Your units (`#/units`, #179), composed from doc/asset/mockups/YourUnits:
// the Direct debit card (ADR-020), then one card per unit of the viewer's
// with its unpaid charges, each with Pay (#153): a Table from 800px, a
// stacked row per charge below it (#202). A paid charge is not listed,
// so a paid arrear stops showing (information view R4).
import { BadgeCheck, Banknote, CircleAlert } from "lucide-react";

import { RulesPopover, StatusBadge } from "../components/kaitiaki.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
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
import { date, nzd } from "../format.js";
import { cn } from "../lib/utils.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
import { Heading, rows } from "./home.js";
import { Signed, type Acting } from "./proposal.js";

export const DEBIT_RULES = [
  "The management firm collects each charge on its due date from this wallet.",
  "Approve the levy ledger once for your units' scheduled total, then keep the balance here.",
  "Approving moves no money.",
] as const;

export const PAY_RULES = [
  "Paying takes two signatures in your wallet: approve, then pay.",
  "A scheduled charge can be paid before it falls due.",
  "A paid arrear stops showing anywhere.",
] as const;

type Charge = View["ownUnits"][number]["charges"][number];

export function YourUnits({
  units,
  ownWallet,
  onPay,
  paying,
  onDebit,
  acting,
}: {
  units: View["ownUnits"];
  ownWallet: View["ownWallet"];
  // Without it, no charge has a Pay button.
  onPay?: (unitId: bigint, chargeId: bigint, amount: bigint) => void;
  // The charge whose payment the wallet is signing.
  paying?: bigint;
  // Approves the levy ledger for `total`. Without it, no button.
  onDebit?: (total: bigint) => void;
  acting?: Acting;
}) {
  // Every unpaid charge of the viewer's units, the most the firm can take.
  const total = units
    .flatMap((u) => u.charges)
    .reduce((sum, c) => sum + c.amount, 0n);
  // One write at a time: each approval sets the allowance, so a second
  // would starve the first.
  const busy = acting !== undefined || paying !== undefined;
  const state = (c: Charge) =>
    c.overdue ? <StatusBadge word="in arrears" /> : "Scheduled";
  const pay = (unitId: bigint, c: Charge, className?: string) =>
    onPay && (
      <Button
        type="button"
        variant={c.due ? "default" : "outline"}
        className={className}
        aria-disabled={busy || undefined}
        onClick={busy ? undefined : () => onPay(unitId, c.chargeId, c.amount)}
      >
        {paying === c.chargeId ? (
          <Waiting />
        ) : c.due ? (
          <>
            <Banknote aria-hidden="true" />
            Pay now
          </>
        ) : (
          "Pay early"
        )}
      </Button>
    );
  const figures = [
    ["Scheduled total", total],
    ["Approved", ownWallet?.approved],
    ["Wallet balance", ownWallet?.balance],
  ] as const;
  return (
    <>
      <h1>Your units</h1>
      <Card
        role="region"
        aria-labelledby="h-debit"
        className="border-2 border-primary"
      >
        <CardHeader>
          <Heading id="h-debit">Direct debit</Heading>
          <CardAction>
            <RulesPopover rules={DEBIT_RULES} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 wide:grid-cols-3">
            {figures.map(
              ([term, amount]) =>
                amount !== undefined && (
                  <div key={term} className="flex flex-col gap-0.5">
                    <dt className="text-base text-muted-foreground">{term}</dt>
                    <dd className="text-2xl font-semibold tabular-nums">
                      {nzd(amount)}
                    </dd>
                  </div>
                ),
            )}
          </dl>
        </CardContent>
        {onDebit && total > 0n && (
          <CardFooter className="flex-wrap gap-3">
            <Button
              size="lg"
              type="button"
              aria-disabled={busy || undefined}
              onClick={busy ? undefined : () => onDebit(total)}
            >
              {acting?.action === "debit" ? (
                <Waiting />
              ) : (
                <>
                  <BadgeCheck aria-hidden="true" />
                  Set up direct debit
                </>
              )}
            </Button>
            <Signed />
          </CardFooter>
        )}
      </Card>
      {units.map((u) => {
        const id = `h-unit-${u.unitId}`;
        return (
          <Card key={id} role="region" aria-labelledby={id}>
            <CardHeader>
              <Heading id={id}>{`Unit ${u.unitId}`}</Heading>
              <CardAction className="flex items-center gap-2">
                <StatusBadge word={u.status} />
                {onPay && u.charges.length > 0 && (
                  <RulesPopover rules={PAY_RULES} />
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {u.charges
                .filter((c) => c.overdue)
                .map((c) => (
                  <Alert key={String(c.chargeId)} variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>
                      Charge #{String(c.chargeId)} was not covered when the
                      firm collected it on {date(c.collected!)}
                    </AlertTitle>
                    <AlertDescription>
                      Pay it now to clear the arrear.
                    </AlertDescription>
                  </Alert>
                ))}
              {u.charges.length ? (
                // Both layouts are in the markup, so the tests read them
                // both: the Table from 800px, a stacked row per charge below.
                <>
                  <div className="max-wide:hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Charge</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>
                            <span className="sr-only">Action</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {u.charges.map((c) => (
                          <TableRow key={String(c.chargeId)}>
                            <TableCell>#{String(c.chargeId)}</TableCell>
                            <TableCell>{date(c.dueDate)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {nzd(c.amount)}
                            </TableCell>
                            <TableCell>{state(c)}</TableCell>
                            <TableCell className="text-right">
                              {pay(u.unitId, c)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ul className={cn(rows, "wide:hidden")}>
                    {u.charges.map((c) => (
                      <li key={String(c.chargeId)} className="flex flex-col gap-2">
                        <span className="flex justify-between gap-3">
                          <span className="font-semibold">#{String(c.chargeId)}</span>
                          <span className="tabular-nums">{nzd(c.amount)}</span>
                        </span>
                        <span className="flex flex-wrap items-center justify-between gap-3 text-base">
                          <span className="text-muted-foreground">Due {date(c.dueDate)}</span>
                          {state(c)}
                        </span>
                        {pay(u.unitId, c, "w-full")}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="font-semibold">No unpaid charges.</p>
              )}
            </CardContent>
            {onPay && u.charges.length > 0 && (
              <CardFooter>
                <Signed />
              </CardFooter>
            )}
          </Card>
        );
      })}
    </>
  );
}
