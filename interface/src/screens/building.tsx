// Building (`#/building`, #180), composed from doc/asset/mockups/Building:
// the two funds, what the contract guarantees, every other unit and the
// approved vendors. It offers no action.
//
// The register is OtherUnitRow's markup exactly, which the NFR10 test reads:
// `<li data-other-unit>`, and the status in an element whose last attribute
// is `data-arrears`, with nothing else in the row beyond the unit's name.
import { Check, Info, KeyRound } from "lucide-react";

import {
  Address,
  Fund,
  FUND_NAMES,
  RulesPopover,
} from "../components/kaitiaki.js";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card.js";
import { date, nzd, unitsLabel } from "../format.js";
import { cn } from "../lib/utils.js";
import type { View } from "../view.js";
import { Heading, rows } from "./home.js";

export const GUARANTEES = [
  "Money leaves only for a proposal owners approved.",
  "It goes only to a vendor owners approved.",
  "Never more than the proposal's limit.",
  "Only from the fund the proposal named.",
] as const;

export const GUARANTEE_RULES = [
  "These are facts about the contract, not promises about the work.",
] as const;

export const VENDOR_RULES = [
  "Each vendor was admitted by an owners' vote.",
  "Money can go to no one else.",
  "No vendor can be removed.",
] as const;

// The approved vendors, each by name, then its company identifier and the
// proposal that admitted it, then its shortened address with Copy. Vendors
// adds the date each was admitted.
export function VendorList({
  vendors,
  dated = false,
}: {
  vendors: View["vendors"];
  dated?: boolean;
}) {
  return vendors.length ? (
    <ul className={rows}>
      {vendors.map((v) => (
        <li
          key={v.payee}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{v.name}</span>
            <span className="text-base text-muted-foreground">
              {v.companyId}, admitted {dated && `${date(v.approvedAt)} `}by
              proposal #{String(v.proposalId)}
            </span>
          </span>
          <Address value={v.payee} label={`Copy ${v.name}'s address`} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="font-semibold">No vendor is approved yet.</p>
  );
}

export function Building({
  funds,
  queued,
  ownUnits,
  otherUnits,
  vendors,
}: {
  funds: View["funds"];
  queued: View["queued"];
  ownUnits: View["ownUnits"];
  otherUnits: View["otherUnits"];
  vendors: View["vendors"];
}) {
  const own = ownUnits.map((u) => u.unitId);
  return (
    <>
      <h1>Building</h1>
      {/* FundCard: one card per fund, side by side, never summed. */}
      <div className="grid items-start gap-6 wide:grid-cols-2">
        {[
          [funds.operating, queued.operating],
          [funds.maintenance, queued.maintenance],
        ].map(([balance, cap], i) => (
          <Card
            key={FUND_NAMES[i]}
            role="region"
            aria-labelledby={`h-fund-${i}`}
            data-fund={i ? "ltm" : "op"}
            className={cn(
              "border-t-4",
              i ? "border-t-fund-ltm" : "border-t-fund-operating",
            )}
          >
            <CardHeader>
              <CardTitle>
                <h2 id={`h-fund-${i}`} className="text-xl">
                  <Fund fund={BigInt(i)} />
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              <span className="text-[1.75rem] leading-tight font-semibold tabular-nums">
                {nzd(balance)}
              </span>
              <span className="text-base text-muted-foreground">
                Queued to pay, at most{" "}
                <span className="whitespace-nowrap tabular-nums">
                  {nzd(cap)}
                </span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card role="region" aria-labelledby="h-guarantees">
        <CardHeader>
          <Heading id="h-guarantees">What the contract guarantees</Heading>
          <CardAction>
            <RulesPopover rules={GUARANTEE_RULES} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className={rows}>
            {GUARANTEES.map((g) => (
              <li key={g} className="flex gap-2.5">
                <Check
                  aria-hidden="true"
                  className="mt-1 size-[18px] flex-none text-success"
                />
                {g}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card role="region" aria-labelledby="h-units">
        <CardHeader>
          <Heading id="h-units">Other units</Heading>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          {/* The disclosure line: always visible beside the register. */}
          <Alert
            role="note"
            className="border-transparent bg-accent text-accent-foreground"
          >
            <Info aria-hidden="true" />
            <AlertTitle>The full record is public on the chain.</AlertTitle>
            <AlertDescription className="text-foreground">
              This page chooses to show only whether each unit is current or in
              arrears.
            </AlertDescription>
          </Alert>
          {otherUnits.length ? (
            <ul
              className="grid w-full grid-cols-2 gap-x-4 wide:grid-cols-4 wide:gap-x-6 [&>li]:flex [&>li]:min-h-11 [&>li]:items-center [&>li]:justify-between [&>li]:border-b [&>li]:py-0 [&>li]:text-base"
              aria-label="Other units"
            >
              {otherUnits.map((u) => (
                <li key={String(u.unitId)} data-other-unit="">
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    Unit {String(u.unitId)}
                  </span>
                  <span
                    className="status inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-base font-semibold"
                    data-tone={u.status === "current" ? "ok" : "late"}
                    data-arrears=""
                  >
                    {u.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-semibold">
              No other unit is in the building.
            </p>
          )}
          <Button variant="ghost" asChild>
            <a href="#/units" className="text-foreground no-underline">
              <KeyRound aria-hidden="true" />
              {unitsLabel(own)} {own.length > 1 ? "are" : "is"} on Your units
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card role="region" aria-labelledby="h-vendors">
        <CardHeader>
          <Heading id="h-vendors">Approved vendors</Heading>
          <CardAction>
            <RulesPopover rules={VENDOR_RULES} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <VendorList vendors={vendors} />
        </CardContent>
      </Card>
    </>
  );
}
