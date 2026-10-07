// Screen 6, Firm (`#/firm`, #157, #173): propose a vendor; Propose work
// (#183) and Collect levies (#184) are their own screens, Confirm work is on
// Proposal (#178). Only the firm's wallet can (`NotFirm` in Governance and
// LevyLedger), so for every other viewer the same forms are drawn disabled.
// Each form reads its fields when submitted and holds only the hints for
// what failed; a malformed value never reaches ethers. An empty name,
// identifier or description is left to the contract, whose refusal the
// RefusalNotice words.
import { isAddress, isHexString, parseUnits } from "ethers";
import { useState, type FormEvent, type ReactNode } from "react";

import { PageHead } from "../shell.js";
import { Waiting } from "../states.js";
import type { Acting } from "./proposal.js";

export type Work = {
  description: string;
  limit: bigint;
  fund: number;
  vendor: string;
  quoteHash: string;
};
export type NewVendor = { vendor: string; name: string; companyId: string };

// What the firm can do. Absent, every form is read-only.
export type FirmActs = {
  onWork: (work: Work) => void;
  onVendor: (vendor: NewVendor) => void;
  onConfirm: (proposalId: bigint, evidenceHash: string) => void;
  onCollect: (chargeIds: bigint[]) => void;
};

type Fields = Record<string, string>;
type Hints = Record<string, string>;

const HASH = "A hash is 0x followed by 64 hexadecimal digits.";
const ADDRESS = "A wallet address is 0x followed by 40 hexadecimal digits.";
const hash = (v: string) => (isHexString(v, 32) ? undefined : HASH);
const address = (v: string) => (isAddress(v) ? undefined : ADDRESS);

// A positive amount in NZD, in the token's units. Commas and a leading
// "NZD" are allowed, as the design system writes amounts.
const amount = (v: string) => v.replace(/^\s*NZD\s*/i, "").replace(/,/g, "").trim();
function cap(v: string) {
  return /^\d+(\.\d{1,18})?$/.test(amount(v)) && parseUnits(amount(v), 18) > 0n
    ? undefined
    : "Enter the limit as an amount in NZD, such as 1,800.00.";
}

export function checkWork(f: Fields) {
  const hints: Hints = {};
  const check = (name: string, hint?: string) => hint && (hints[name] = hint);
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

export function checkVendor(f: Fields) {
  const wallet = address(f.wallet);
  const hints: Hints = wallet ? { wallet } : {};
  return {
    hints,
    vendor: wallet
      ? undefined
      : { vendor: f.wallet, name: f.name, companyId: f.companyId },
  };
}

// An empty evidence hash has the design system's own words.
export const checkEvidence = (v: string) =>
  v ? hash(v) : "Add the evidence hash before confirming.";

function submit<T>(
  busy: boolean,
  setHints: (hints: Hints) => void,
  check: (f: Fields) => { hints: Hints; value?: T },
  send?: (value: T) => void,
) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !send) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Fields;
    const { hints, value } = check(f);
    setHints(hints);
    if (value) send(value);
  };
}

// A field with its label, and its hint: the failed check's, else `hint`.
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <span
          className="field-hint"
          id={`${id}-e`}
          style={{ color: "var(--destructive)" }}
        >
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

// The invalid input's attributes, which point at its hint.
const invalid = (id: string, error?: string) =>
  error ? { "aria-invalid": true, "aria-describedby": `${id}-e` } : {};

// A submit button: one write at a time, and the wallet's wait on the one pressed.
function Submit({
  label,
  readOnly,
  acting,
  mine,
}: {
  label: string;
  readOnly: boolean;
  acting?: Acting;
  mine: boolean;
}) {
  return (
    <button
      className="btn"
      type="submit"
      disabled={readOnly}
      aria-disabled={acting !== undefined || undefined}
    >
      {mine ? (
        <Waiting />
      ) : (
        label
      )}
    </button>
  );
}

function ProposeVendor({ act, acting }: { act?: FirmActs; acting?: Acting }) {
  const [hints, setHints] = useState<Hints>({});
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Propose a vendor</h2>
        <p className="card-description">
          Owners vote on adding them to the approved list.
        </p>
      </div>
      <form
        style={{ display: "contents" }}
        noValidate
        onSubmit={submit(
          acting !== undefined,
          setHints,
          (f) => {
            const { hints, vendor } = checkVendor(f);
            return { hints, value: vendor };
          },
          act?.onVendor,
        )}
      >
        <div className="card-content stack">
          <Field id="v-name" label="Name">
            <input
              className="input"
              id="v-name"
              name="name"
              disabled={!act}
            />
          </Field>
          <Field id="v-co" label="Company identifier">
            <input
              className="input"
              id="v-co"
              name="companyId"
              disabled={!act}
            />
          </Field>
          <Field
            id="v-addr"
            label="Vendor’s wallet address"
            error={hints.wallet}
          >
            <input
              className="input mono"
              id="v-addr"
              name="wallet"
              placeholder="0x…"
              disabled={!act}
              {...invalid("v-addr", hints.wallet)}
            />
          </Field>
        </div>
        <div className="card-footer">
          <Submit
            label="Propose vendor"
            readOnly={!act}
            acting={acting}
            mine={acting?.action === "vendor"}
          />
        </div>
      </form>
    </section>
  );
}

export function Firm({
  act,
  acting,
  fresh = { work: 0, vendor: 0 },
}: {
  act?: FirmActs;
  acting?: Acting;
  // A new number empties that form: a new key mounts it afresh.
  fresh?: { work: number; vendor: number };
}) {
  return (
    <>
      <PageHead title="Firm workspace">
        <p className="muted-text">For the management firm’s wallet.</p>
      </PageHead>
      <div className="alert">
        <p className="alert-title">
          You can propose, confirm and collect levies. You cannot move money
          out.
        </p>
        <p className="alert-description">
          Owners decide every proposal. Payment releases only through the
          contract, and a collected levy goes only to the treasury. Other
          wallets see this page read-only.
        </p>
      </div>
      <ProposeVendor key={fresh.vendor} act={act} acting={acting} />
    </>
  );
}
