// Screen 3, Your units (`#/units`): the viewer's own units and each overdue
// charge's amount and due date. Pay arrives with its screen issue.
import { Fragment, type ReactNode } from "react";

import { date, nzd } from "../format.js";
import { PageHead } from "../shell.js";
import type { View } from "../view.js";

export function YourUnits({
  units,
  children,
}: {
  units: View["ownUnits"];
  // The wallet's Screen 8 state, if any.
  children?: ReactNode;
}) {
  return (
    <>
      <PageHead title="Your units and levies" />
      {children}
      {units.length > 0 && (
        <div className="card">
          <div
            className="card-content stack"
            style={{ paddingTop: "var(--space-6)" }}
          >
            {units.map((u, i) => (
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
                  {u.overdue.length === 0 && (
                    <p className="muted-text">No overdue charges.</p>
                  )}
                  {u.overdue.map((c) => (
                    <div key={String(c.chargeId)} className="charge">
                      <div>
                        <p className="charge-amount">{nzd(c.amount)}</p>
                        <p
                          className="field-hint"
                          style={{ color: "var(--foreground)" }}
                        >
                          Charge #{String(c.chargeId)} · was due{" "}
                          {date(c.dueDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
