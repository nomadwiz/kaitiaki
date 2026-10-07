// Vendors (`#/vendors`, #185), composed from doc/asset/mockups/Vendors: the
// approved vendors, and the firm's form to propose another (ADR-018).
// `checkVendor` catches a malformed wallet address before anything is sent;
// an empty name or identifier is left to the contract, whose refusal the
// RefusalNotice words. The form is emptied only once the proposal is mined
// (a new `key` from App's `fresh`).
import { Store } from "lucide-react";
import { useState, type FormEvent } from "react";

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
import { Input } from "../components/ui/input.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
import { VendorList } from "./building.js";
import { Heading } from "./home.js";
import { address, hint, invalid, label } from "./propose.js";
import { Signed, type Acting, type FirmActs } from "./proposal.js";

export type NewVendor = { vendor: string; name: string; companyId: string };

export const LIST_RULES = [
  "Work can be paid only to a vendor owners admitted by vote.",
  "No vendor can be removed.",
] as const;

export const PROPOSE_VENDOR_RULES = [
  "Owners vote on the name, the identifier and the address together.",
  "The company identifier is your statement. No contract checks it against a company register.",
] as const;

export function checkVendor(f: Record<string, string>) {
  const wallet = address(f.wallet);
  return {
    hints: wallet ? { wallet } : ({} as Record<string, string>),
    vendor: wallet
      ? undefined
      : { vendor: f.wallet, name: f.name, companyId: f.companyId },
  };
}

export function Vendors({
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
  const busy = acting !== undefined;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !act) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { hints, vendor } = checkVendor(f);
    setHints(hints);
    if (vendor) act.onVendor(vendor);
  };
  return (
    <>
      <h1>Vendors</h1>
      <div className="grid items-start gap-6 wide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card role="region" aria-labelledby="h-vendors">
          <CardHeader>
            <Heading id="h-vendors">Approved vendors</Heading>
            {vendors.length > 0 && (
              <CardDescription className="tabular-nums">
                {vendors.length} vendor{vendors.length === 1 ? "" : "s"}
              </CardDescription>
            )}
            <CardAction>
              <RulesPopover rules={LIST_RULES} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <VendorList vendors={vendors} dated />
          </CardContent>
        </Card>
        <form aria-labelledby="h-new-vendor" noValidate onSubmit={submit}>
          <Card className="border-2 border-primary">
            <CardHeader>
              <Heading id="h-new-vendor">Propose a vendor</Heading>
              <CardAction>
                <RulesPopover rules={PROPOSE_VENDOR_RULES} />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="v-name" className={label}>
                  Name
                </label>
                <Input id="v-name" name="name" disabled={!act} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="v-co" className={label}>
                  Company identifier
                </label>
                <Input id="v-co" name="companyId" disabled={!act} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="v-addr" className={label}>
                  Wallet address
                </label>
                <Input
                  id="v-addr"
                  name="wallet"
                  placeholder="0x…"
                  className="font-mono"
                  disabled={!act}
                  {...invalid("v-addr", hints.wallet)}
                />
                {hint("v-addr", hints.wallet)}
              </div>
            </CardContent>
            <CardFooter className="flex-wrap gap-3">
              <Button
                size="lg"
                type="submit"
                className="w-full"
                disabled={!act}
                aria-disabled={busy || undefined}
              >
                {acting?.action === "vendor" ? (
                  <Waiting />
                ) : (
                  <>
                    <Store aria-hidden="true" />
                    Propose vendor
                  </>
                )}
              </Button>
              <Signed />
            </CardFooter>
          </Card>
        </form>
      </div>
    </>
  );
}
