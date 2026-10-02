// Markup for the read interface (#72), as a string, so the NFR10 check in
// test/interface.ts runs over exactly what the browser is given.
//
// Every arrears status of a unit other than the viewer's own sits in an
// element marked `data-arrears`, and its row says nothing else beyond the
// unit's name. The test checks those rows for digits.
import { formatUnits } from "ethers";

import type { View } from "./view.js";

const FUNDS = ["Operating", "Long-term maintenance"];

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const nzd = (amount: bigint) =>
  `NZD ${Number(formatUnits(amount, 18)).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date = (timestamp: bigint) =>
  new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);

export function renderBuilding(view: View): string {
  const funds = `
    <section>
      <h2>Funds</h2>
      <dl class="funds">
        <dt>${FUNDS[0]}</dt><dd>${nzd(view.funds.operating)}</dd>
        <dt>${FUNDS[1]}</dt><dd>${nzd(view.funds.maintenance)}</dd>
      </dl>
    </section>`;

  const proposals = view.proposals
    .map((p) => {
      const what =
        p.kind === "Work"
          ? `${escape(p.description)} — up to ${nzd(p.limit)} from ${
              FUNDS[Number(p.fund)]
            }, paid to <code>${p.payee}</code>`
          : `<code>${p.payee}</code> joins the approved vendors`;
      const form = p.canVote
        ? `<form class="vote" data-proposal="${p.id}">
              <button type="submit" name="inFavour" value="true">Vote for</button>
              <button type="submit" name="inFavour" value="false">Vote against</button>
            </form>`
        : "";
      return `
        <li>
          <span class="badge ${p.state.toLowerCase()}">${p.state}</span>
          <strong>#${p.id} ${p.kind}</strong> ${what}
          <span class="tally">${p.forVotes} for · ${p.againstVotes} against</span>
          ${form}
        </li>`;
    })
    .join("");

  const own = view.ownUnits
    .map(
      (u) => `
        <li>
          <span class="unit">Unit ${u.unitId}</span>
          <span class="status ${u.status === "current" ? "ok" : "late"}">${u.status}</span>
          ${
            u.overdue.length
              ? `<ul class="overdue">${u.overdue
                  .map(
                    (c) =>
                      `<li>${nzd(c.amount)} was due ${date(c.dueDate)} (charge ${c.chargeId})</li>`,
                  )
                  .join("")}</ul>`
              : ""
          }
        </li>`,
    )
    .join("");

  const others = view.otherUnits
    .map(
      (u) => `
        <li data-other-unit>
          <span class="unit">Unit ${u.unitId}</span>
          <span class="status ${u.status === "current" ? "ok" : "late"}" data-arrears>${u.status}</span>
        </li>`,
    )
    .join("");

  return `
    ${funds}
    <section>
      <h2>Proposals</h2>
      <ul class="proposals">${proposals || "<li>None yet.</li>"}</ul>
    </section>
    <section>
      <h2>Your units</h2>
      ${
        own
          ? `<ul class="units">${own}</ul>`
          : "<p>This wallet holds no unit, so it cannot vote.</p>"
      }
    </section>
    <section>
      <h2>Other units</h2>
      <p class="note">Status only. The full record is public on the chain; this page shows no amounts or dates for another owner's unit.</p>
      <ul class="units">${others}</ul>
    </section>`;
}
