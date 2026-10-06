// Screen 3, Your units (`#/units`): the viewer's own units, every unpaid
// charge of each, and Pay (#153). `OwnUnits` is also Home's Your levies card,
// which passes no `onPay`: Home has no action.
import { Fragment, type ReactNode } from "react";

import { date, nzd } from "../format.js";
import { PageHead } from "../shell.js";
import type { View } from "../view.js";

export function OwnUnits({
  units,
  overdueOnly,
  onPay,
  paying,
  children,
}: {
  units: View["ownUnits"];
  // Home lists only overdue charges; Your units lists every unpaid one.
  overdueOnly?: boolean;
  // Without it, no charge has a Pay button.
  onPay?: (unitId: bigint, chargeId: bigint, amount: bigint) => void;
  // The charge whose payment the wallet is signing.
  paying?: bigint;
  children?: ReactNode;
}) {
  return (
    <div className="card">
      <div
        className="card-content stack"
        style={{ paddingTop: "var(--space-6)" }}
      >
        {units.map((u, i) => {
          const charges = overdueOnly
            ? u.charges.filter((c) => c.overdue)
            : u.charges;
          return (
            <Fragment key={String(u.unitId)}>
              {i > 0 && <hr className="separator" />}
              <div className="own-unit">
                <div className="row">
                  <h3 className="card-title">Unit {String(u.unitId)}</h3>
                  <span
                    className="status"
                    data-tone={u.status === "current" ? "ok" : "late"}
                  >
                    {u.status}
                  </span>
                </div>
                {charges.length === 0 && (
                  <p className="muted-text">
                    No {overdueOnly ? "overdue" : "unpaid"} charges.
                  </p>
                )}
                {charges.map((c) => (
                  <div key={String(c.chargeId)} className="charge">
                    <div>
                      <p className="charge-amount">{nzd(c.amount)}</p>
                      <p
                        className="field-hint"
                        style={{ color: "var(--foreground)" }}
                      >
                        Charge #{String(c.chargeId)} ·{" "}
                        {c.overdue ? "was due" : "due"} {date(c.dueDate)} ·{" "}
                        {c.issued ? "issued" : "scheduled"}
                      </p>
                    </div>
                    {onPay &&
                      (paying === c.chargeId ? (
                        <button
                          className="btn"
                          type="button"
                          aria-disabled="true"
                        >
                          <span className="spinner" aria-hidden="true"></span>
                          Waiting for your wallet…
                        </button>
                      ) : (
                        // One payment at a time: each approval sets the
                        // allowance, so a second would starve the first.
                        <button
                          className="btn"
                          type="button"
                          aria-disabled={
                            paying === undefined ? undefined : true
                          }
                          onClick={
                            paying === undefined
                              ? () => onPay(u.unitId, c.chargeId, c.amount)
                              : undefined
                          }
                        >
                          Pay {nzd(c.amount)}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            </Fragment>
          );
        })}
        {children}
      </div>
    </div>
  );
}

export function YourUnits({
  units,
  onPay,
  paying,
  children,
}: {
  units: View["ownUnits"];
  onPay?: (unitId: bigint, chargeId: bigint, amount: bigint) => void;
  paying?: bigint;
  // The wallet's Screen 8 state, if any.
  children?: ReactNode;
}) {
  return (
    <>
      <PageHead title="Your units and levies">
        <p className="muted-text">
          Your own charges, in full. Only you see amounts and dates for your
          units.
        </p>
      </PageHead>
      {children}
      {units.length > 0 && (
        <div className="grid-main">
          <OwnUnits units={units} onPay={onPay} paying={paying}>
            <p className="field-hint">
              Anyone may pay a charge for a unit. The payment credits the unit,
              not the payer. Once paid, an arrear stops showing, here too.
            </p>
          </OwnUnits>
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">How levies work</h2>
            </div>
            <div className="card-content stack">
              <p className="body-sm">
                Each charge has a unit, an amount and a due date. A unit is{" "}
                <b>in arrears</b> while a charge is issued, unpaid and past due.
              </p>
              <p className="body-sm">
                Each payment is split between the Operating and Long-term
                maintenance funds.
              </p>
              <p className="body-sm">You pay from your own wallet, in NZD.</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
