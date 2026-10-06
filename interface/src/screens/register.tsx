// Building (`#/building`), until #180 rebuilds it from its mock-up: every other unit, as OtherUnitRow's
// markup exactly, beside the privacy line. The NFR10 test reads these rows:
// `<li data-other-unit>`, and the status in an element whose last attribute
// is `data-arrears`, with nothing else in the row beyond the unit's name.
import { date } from "../format.js";
import { Address, PageHead } from "../shell.js";
import type { View } from "../view.js";

const GUARANTEES = [
  [
    "Approved proposal",
    "No one can spend without a proposal that owners passed.",
  ],
  [
    "Approved vendor",
    "Money goes only to a vendor owners approved, and only the one the proposal names.",
  ],
  ["Within the cap", "A proposal never pays more than its spending cap."],
  [
    "Right fund",
    "A proposal pays only from the fund it names. The two funds never mix.",
  ],
] as const;

function Guarantees() {
  return (
    <div className="guarantees">
      <strong>The contract protects the money:</strong>
      {GUARANTEES.map(([name, sentence]) => (
        <details key={name}>
          <summary>{name}</summary>
          <p>{sentence}</p>
        </details>
      ))}
    </div>
  );
}

export function Register({
  units,
  vendors,
}: {
  units: View["otherUnits"];
  vendors: View["vendors"];
}) {
  return (
    <>
      <PageHead title="Building">
        <Guarantees />
      </PageHead>
      <section aria-labelledby="h-reg" className="card">
        <div className="card-header">
          <h2 className="card-title" id="h-reg">
            Other units
          </h2>
          <p className="privacy-line">
            The full record is public on the chain. This page chooses to show
            only whether each unit is current or in arrears. That is a
            presentation choice, not protection.
          </p>
        </div>
        <div className="card-content">
          <ul className="register" aria-label="Other units">
            {units.map((u) => (
              <li key={String(u.unitId)} data-other-unit="">
                <span className="unit">Unit {String(u.unitId)}</span>
                <span
                  className="status"
                  data-tone={u.status === "current" ? "ok" : "late"}
                  data-arrears=""
                >
                  {u.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section aria-labelledby="h-ven" className="card">
        <div className="card-header">
          <h2 className="card-title" id="h-ven">
            Approved vendors
          </h2>
          <p className="card-description">
            Only these can be paid. Owners add a vendor by passing an Admit
            vendor proposal.
          </p>
        </div>
        <div className="card-content" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Wallet</th>
                <th>Company identifier</th>
                <th>Approved by</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.payee}>
                  <td>
                    <b>{v.name}</b>
                  </td>
                  <td>
                    <Address value={v.payee} />
                  </td>
                  <td>{v.companyId}</td>
                  <td>
                    Proposal #{String(v.proposalId)}, {date(v.approvedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
