// Collect levies (`#/collect`, #184), composed from
// doc/asset/mockups/CollectLevies: the firm's collection (ADR-020). Every
// due, unpaid charge starts selected, and Collect sends the selection in one
// LevyLedger.collect call. Charges are listed by number and dates, never by
// unit or amount (NFR10). The mock-up's Last collection is not drawn: the
// log cannot say what the last call did, because a retry still not covered
// emits nothing and a covered one reads as an owner's own payment
// (interface.md §4). The call's own result is its toast (tx.ts).
import { HandCoins } from "lucide-react";
import { useState } from "react";

import { RulesPopover } from "../components/kaitiaki.js";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "../components/ui/card.js";
import { Checkbox } from "../components/ui/checkbox.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { date } from "../format.js";
import { cn } from "../lib/utils.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
import type { FirmActs } from "./firm.js";
import { Heading } from "./home.js";
import { Signed, type Acting } from "./proposal.js";

export const COLLECT_RULES = [
  "Each due charge is taken from its owner's wallet, where the owner approved it and holds the amount.",
  "A charge that is not covered stays owed and falls into arrears. Collect it again later.",
  "A retry that is still not covered leaves no record.",
  "A charge its owner paid since this list was read is skipped, not refused.",
  "Charges are listed by number, never by unit.",
  "A charge can be collected from its due date, not before.",
] as const;

const charges = (n: number) => `${n} charge${n === 1 ? "" : "s"}`;

export function CollectLevies({
  toCollect,
  act,
  acting,
}: {
  toCollect: View["toCollect"];
  // Absent on the wrong chain: nothing can be chosen or sent.
  act?: FirmActs;
  acting?: Acting;
}) {
  // The charges the firm unticked; every other due charge is collected,
  // one that falls due later included.
  const [left, setLeft] = useState<ReadonlySet<bigint>>(new Set());
  const due = toCollect.filter((c) => c.due);
  const chosen = due.filter((c) => !left.has(c.chargeId)).map((c) => c.chargeId);
  const later = toCollect.filter((c) => !c.due);
  const next = later.reduce<bigint | undefined>(
    (min, c) => (min === undefined || c.dueDate < min ? c.dueDate : min),
    undefined,
  );
  const coming = later.filter((c) => c.dueDate === next).length;
  const busy = acting !== undefined;
  const pick = (id: bigint, on: boolean) =>
    setLeft((l) => {
      const s = new Set(l);
      if (on) s.delete(id);
      else s.add(id);
      return s;
    });
  return (
    <>
      <h1>Collect levies</h1>
      <Card
        role="region"
        aria-labelledby="h-due"
        className={cn(due.length > 0 && "border-2 border-primary")}
      >
        <CardHeader>
          <Heading id="h-due">Due now</Heading>
          <CardDescription className="tabular-nums">
            {due.length ? charges(due.length) : "No charge is due."}
          </CardDescription>
          <CardAction>
            <RulesPopover rules={COLLECT_RULES} />
          </CardAction>
        </CardHeader>
        {due.length > 0 && (
          <>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="Select every due charge"
                        checked={
                          chosen.length === due.length
                            ? true
                            : chosen.length > 0 && "indeterminate"
                        }
                        disabled={!act}
                        onCheckedChange={(on) =>
                          setLeft(on === true ? new Set() : new Set(due.map((c) => c.chargeId)))
                        }
                      />
                    </TableHead>
                    <TableHead>Charge</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {due.map((c) => (
                    <TableRow key={String(c.chargeId)}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Collect Charge #${c.chargeId}`}
                          checked={!left.has(c.chargeId)}
                          disabled={!act}
                          onCheckedChange={(on) => pick(c.chargeId, on === true)}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums">#{String(c.chargeId)}</TableCell>
                      <TableCell>{date(c.dueDate)}</TableCell>
                      <TableCell>
                        {c.issued === undefined
                          ? "Not yet"
                          : `${date(c.issued)}, not covered`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap gap-4">
              <Button
                size="lg"
                type="button"
                disabled={!act || chosen.length === 0}
                aria-disabled={busy || undefined}
                onClick={act && !busy ? () => act.onCollect(chosen) : undefined}
              >
                {acting?.action === "collect" ? (
                  <Waiting />
                ) : (
                  <>
                    <HandCoins aria-hidden="true" />
                    Collect {charges(chosen.length)}
                  </>
                )}
              </Button>
              <Signed />
            </CardFooter>
          </>
        )}
      </Card>
      <Card role="region" aria-labelledby="h-coming">
        <CardHeader>
          <Heading id="h-coming">Coming due</Heading>
          <CardDescription>
            {next === undefined
              ? "No charge is scheduled."
              : `${charges(coming)} ${coming === 1 ? "falls" : "fall"} due on ${date(next)}.`}
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
