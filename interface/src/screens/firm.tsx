// Screen 6, Firm (`#/firm`, #157, #173): propose work, propose a vendor,
// collect due levies; Confirm work is on Proposal (#178). Only the firm's
// wallet can (`NotFirm` in Governance and LevyLedger), so for every other
// viewer the same forms are drawn disabled. Each form reads its fields
// when submitted and holds only the hints for what failed; a malformed value
// never reaches ethers. An empty name, identifier or description is left to
// the contract, whose refusal the RefusalNotice words.
import { isAddress, isHexString, parseUnits } from "ethers";
import { useState, type FormEvent, type ReactNode } from "react";

import { FUND_NAMES } from "../components/kaitiaki.js";
import { date } from "../format.js";
import { PageHead } from "../shell.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";
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

// A positive amount in NZD, in the token's units. Commas are allowed, as
// the design system writes amounts.
function cap(v: string) {
  const amount = v.replace(/,/g, "").trim();
  return /^\d+(\.\d{1,18})?$/.test(amount) && parseUnits(amount, 18) > 0n
    ? undefined
    : "Enter the cap as an amount in NZD, such as 1,800.00.";
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
        limit: parseUnits(f.cap.replace(/,/g, "").trim(), 18),
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

function ProposeWork({
  vendors,
  act,
  acting,
}: {
  vendors: View["vendors"];
  act?: FirmActs;
  acting?: Acting;
}) {
  const [hints, setHints] = useState<Hints>({});
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Propose work</h2>
        <p className="card-description">Owners then have 14 days to vote.</p>
      </div>
      <form
        style={{ display: "contents" }}
        noValidate
        onSubmit={submit(
          acting !== undefined,
          setHints,
          (f) => {
            const { hints, work } = checkWork(f);
            return { hints, value: work };
          },
          act?.onWork,
        )}
      >
        <div className="card-content stack">
          <Field id="f-desc" label="What the work is">
            <textarea
              className="textarea"
              id="f-desc"
              name="description"
              disabled={!act}
            ></textarea>
          </Field>
          <div className="grid-2" style={{ gap: "var(--space-3)" }}>
            <Field id="f-cap" label="Spending cap (NZD)" error={hints.cap}>
              <input
                className="input num"
                id="f-cap"
                name="cap"
                inputMode="decimal"
                placeholder="0.00"
                disabled={!act}
                {...invalid("f-cap", hints.cap)}
              />
            </Field>
            <Field id="f-fund" label="Pays from">
              <select
                className="select"
                id="f-fund"
                name="fund"
                disabled={!act}
              >
                {FUND_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            id="f-ven"
            label="Vendor"
            hint="Only approved vendors are listed."
            error={hints.vendor}
          >
            <select
              className="select"
              id="f-ven"
              name="vendor"
              disabled={!act}
              {...invalid("f-ven", hints.vendor)}
            >
              {vendors.map((v) => (
                <option key={v.payee} value={v.payee}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="f-quote"
            label="Quote document hash"
            error={hints.quote}
          >
            <input
              className="input mono"
              id="f-quote"
              name="quote"
              placeholder="0x…"
              disabled={!act}
              {...invalid("f-quote", hints.quote)}
            />
          </Field>
        </div>
        <div className="card-footer">
          <Submit
            label="Propose work"
            readOnly={!act}
            acting={acting}
            mine={acting?.action === "work"}
          />
          <span className="field-hint">Signed in your wallet.</span>
        </div>
      </form>
    </section>
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

// Every due, unpaid charge in one collection (ADR-020). Each is taken from
// its owner's wallet if the owner approved the levy ledger and holds it;
// otherwise it is recorded as owed. Listed without unit or amount.
function CollectLevies({
  charges,
  act,
  acting,
}: {
  charges: View["toCollect"];
  act?: FirmActs;
  acting?: Acting;
}) {
  const due = charges.filter((c) => c.due).map((c) => c.chargeId);
  const busy = acting !== undefined;
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Collect due levies</h2>
        <p className="card-description">
          Takes each due levy from its owner’s wallet, if the owner has set up
          direct debit and holds the amount. If not, the charge is recorded as
          owed and the unit is in arrears after its due date. Charges are
          listed without their unit.
        </p>
      </div>
      <div className="card-content stack" style={{ overflowX: "auto" }}>
        {charges.length === 0 ? (
          <p className="muted-text">No charge is waiting to be collected.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Charge</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={String(c.chargeId)}>
                  <td>Charge #{String(c.chargeId)}</td>
                  <td>{date(c.dueDate)}</td>
                  <td className="muted-text">
                    {c.attempted
                      ? "Not covered when last collected"
                      : c.due
                        ? "Due"
                        : `Available from ${date(c.dueDate)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {due.length > 0 && (
          <button
            className="btn"
            type="button"
            disabled={!act}
            aria-disabled={busy || undefined}
            onClick={act && !busy ? () => act.onCollect(due) : undefined}
          >
            {acting?.action === "collect" ? (
              <Waiting />
            ) : (
              `Collect ${due.length} due charge${due.length === 1 ? "" : "s"}`
            )}
          </button>
        )}
      </div>
    </section>
  );
}

export function Firm({
  vendors,
  toCollect,
  act,
  acting,
  fresh = { work: 0, vendor: 0 },
}: {
  vendors: View["vendors"];
  toCollect: View["toCollect"];
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
      <div className="grid-2">
        <ProposeWork key={fresh.work} vendors={vendors} act={act} acting={acting} />
        <ProposeVendor key={fresh.vendor} act={act} acting={acting} />
      </div>
      <CollectLevies charges={toCollect} act={act} acting={acting} />
    </>
  );
}
