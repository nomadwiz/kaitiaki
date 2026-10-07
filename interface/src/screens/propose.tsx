// Propose work (`#/propose`, #183), composed from doc/asset/mockups/ProposeWork:
// the firm's proposal form, reached from Proposals. `checkWork` catches an
// empty description and a malformed limit, vendor or quote hash before
// anything is sent, and the form is emptied only once the proposal is mined
// (a new `key` from App's `fresh`).
import { isAddress, parseUnits } from "ethers";
import { ListPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Fund, RulesPopover } from "../components/kaitiaki.js";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb.js";
import { Button } from "../components/ui/button.js";
import { Card, CardContent, CardFooter } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select.js";
import { Separator } from "../components/ui/separator.js";
import { Textarea } from "../components/ui/textarea.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
import { hash, Signed, type Acting, type FirmActs } from "./proposal.js";

export const PROPOSE_RULES = [
  "Owners vote for 14 days, or 21 if quorum is not met.",
  "A 7-day wait follows before you can confirm the work.",
  "Only approved vendors can be chosen. A new vendor needs its own vote first.",
  "The limit is the most the vendor can be paid for this work, in total.",
  "The quote stays off the chain; only its hash is recorded.",
  "Owners see exactly what you enter, and vote on the proposal as a whole.",
  "A proposal cannot be edited or withdrawn.",
] as const;

export type Work = {
  description: string;
  limit: bigint;
  fund: number;
  vendor: string;
  quoteHash: string;
};

export const address = (v: string) =>
  isAddress(v) ? undefined : "A wallet address is 0x followed by 40 hexadecimal digits.";

// A positive amount in NZD, in the token's units. Commas and a leading
// "NZD" are allowed, as the design system writes amounts.
const amount = (v: string) => v.replace(/^\s*NZD\s*/i, "").replace(/,/g, "").trim();
function cap(v: string) {
  return /^\d+(\.\d{1,18})?$/.test(amount(v)) && parseUnits(amount(v), 18) > 0n
    ? undefined
    : "Enter the limit as an amount in NZD, such as 1,800.00.";
}

export function checkWork(f: Record<string, string>) {
  const hints: Record<string, string> = {};
  const check = (name: string, hint?: string) => hint && (hints[name] = hint);
  check("description", f.description.trim() ? undefined : "Add what the work is before proposing.");
  check("cap", cap(f.cap));
  check("vendor", f.vendor ? address(f.vendor) : "Choose an approved vendor.");
  check("quote", hash(f.quote));
  const work: Work | undefined = Object.keys(hints).length
    ? undefined
    : {
        description: f.description,
        limit: parseUnits(amount(f.cap), 18),
        fund: Number(f.fund),
        vendor: f.vendor,
        quoteHash: f.quote,
      };
  return { hints, work };
}

export const label = "text-base font-semibold";

// A failed check's hint under its field, and the attributes that point at it.
export const hint = (id: string, text?: string) =>
  text && (
    <p id={`${id}-e`} className="text-base text-destructive">
      {text}
    </p>
  );
export const invalid = (id: string, text?: string) =>
  text ? { "aria-invalid": true, "aria-describedby": `${id}-e` } : {};

export function ProposeWork({
  vendors,
  act,
  acting,
}: {
  // Admitted vendors only (PayeeAdmitted).
  vendors: View["vendors"];
  // Absent on the wrong chain: the form is drawn disabled.
  act?: FirmActs;
  acting?: Acting;
}) {
  const [hints, setHints] = useState<Record<string, string>>({});
  // The two choices are held here rather than read from the form, so the
  // markup shows them before any list has opened.
  const [vendor, setVendor] = useState(vendors[0]?.payee ?? "");
  const [fund, setFund] = useState("0");
  const chosen = vendors.find((v) => v.payee === vendor);
  const busy = acting !== undefined;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !act) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { hints, work } = checkWork({ ...f, vendor, fund });
    setHints(hints);
    if (work) act.onWork(work);
  };
  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#/proposals">Proposals</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Propose work</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Propose work</h1>
        <RulesPopover rules={PROPOSE_RULES} />
      </div>
      <form
        aria-label="Propose work"
        className="max-w-[760px]"
        noValidate
        onSubmit={submit}
      >
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="desc" className={label}>
                What the work is
              </label>
              <Textarea
                id="desc"
                name="description"
                disabled={!act}
                {...invalid("desc", hints.description)}
              />
              {hint("desc", hints.description)}
            </div>
            <div className="flex flex-col gap-2">
              <span id="vendor-l" className={label}>
                Vendor
              </span>
              <Select value={vendor} onValueChange={setVendor} disabled={!act || !vendors.length}>
                <SelectTrigger
                  id="vendor"
                  aria-labelledby="vendor-l"
                  className="w-full"
                  {...invalid("vendor", hints.vendor)}
                >
                  <SelectValue placeholder="No vendor is approved yet.">
                    {chosen && (
                      <span>
                        {chosen.name}{" "}
                        <span className="text-muted-foreground">{chosen.companyId}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.payee} value={v.payee}>
                      {v.name}{" "}
                      <span className="text-muted-foreground">{v.companyId}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hint("vendor", hints.vendor)}
            </div>
            <div className="grid items-start gap-5 wide:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="limit" className={label}>
                  Limit
                </label>
                <Input
                  id="limit"
                  name="cap"
                  inputMode="decimal"
                  placeholder="NZD 0.00"
                  className="tabular-nums"
                  disabled={!act}
                  {...invalid("limit", hints.cap)}
                />
                {hint("limit", hints.cap)}
              </div>
              <div className="flex flex-col gap-2">
                <span id="fund-l" className={label}>
                  Paid from
                </span>
                <RadioGroup
                  value={fund}
                  onValueChange={setFund}
                  aria-labelledby="fund-l"
                  className="gap-0"
                  disabled={!act}
                >
                  {[0n, 1n].map((n) => (
                    <label
                      key={String(n)}
                      htmlFor={`fund-${n}`}
                      className="flex min-h-11 items-center gap-3"
                    >
                      <RadioGroupItem id={`fund-${n}`} value={String(n)} />
                      <Fund fund={n} />
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="quote" className={label}>
                Quote hash
              </label>
              <Input
                id="quote"
                name="quote"
                placeholder="0x…"
                className="font-mono"
                disabled={!act}
                {...invalid("quote", hints.quote)}
              />
              {hint("quote", hints.quote)}
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="flex-wrap gap-4">
            <Button
              size="lg"
              type="submit"
              disabled={!act}
              aria-disabled={busy || undefined}
            >
              {acting?.action === "work" ? (
                <Waiting />
              ) : (
                <>
                  <ListPlus aria-hidden="true" />
                  Propose
                </>
              )}
            </Button>
            <Signed />
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
