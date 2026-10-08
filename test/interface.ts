// The read interface, issues #72 and #149 (FR41, NFR10, information view R4).
//
// NFR10's stated method is an automated check over the rendered output for
// any digit in an arrears context. The interface is React, and each screen is
// a pure component of the view, so this renders it with react-dom/server and
// checks exactly the markup the browser is given, built from the event log of
// a building on the real contracts (scripts/building.ts).
import { expect } from "chai";
import {
  Contract,
  Interface,
  id,
  makeError,
  parseUnits,
  zeroPadValue,
  type FunctionFragment,
} from "ethers";
import { readFile, readdir } from "node:fs/promises";
import hre, { network } from "hardhat";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App, ELSEWHERE, isElsewhere, type Wallet } from "../interface/src/app.js";
import { ACTIVITY_RULES, Activity, PER_PAGE } from "../interface/src/screens/activity.js";
import { GUARANTEES } from "../interface/src/screens/building.js";
import { checkEvidence, votesRules } from "../interface/src/screens/proposal.js";
import { PROPOSE_RULES, ProposeWork, checkWork } from "../interface/src/screens/propose.js";
import { LIST_RULES, PROPOSE_VENDOR_RULES, Vendors, checkVendor } from "../interface/src/screens/vendors.js";
import { COLLECT_RULES, CollectLevies } from "../interface/src/screens/collect.js";
import { date, nzd, short } from "../interface/src/format.js";
import { ABI, approvedRefusal, carryOut, collectLevies, confirmWork, payment, proposeVendor, proposeWork, refusal, send, standingApproval, walletBalance } from "../interface/src/tx.js";
import { buildView } from "../interface/src/view.js";
import { advance, deployBuilding } from "../scripts/building.js";
import { replay } from "../scripts/replay.js";

// What a viewer is shown when `call` is sent: send's own notice or toast.
async function outcome(
  action: Parameters<typeof send>[0],
  call: () => Promise<{ wait(): Promise<unknown> }>,
) {
  const shown: { notice?: unknown; toast?: unknown } = {};
  await send(action, call, {
    prompt: false,
    setSigning() {},
    toast: (t) => void (shown.toast = t),
    setNotice: (n) => void (shown.notice = n),
    async reload() {},
  });
  return shown;
}

const ZERO = "0x" + "11".repeat(20);
const STATES = ["Open", "Extended", "Passed", "Failed", "Queued", "Executed"];

// Markup as the words a viewer reads.
const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// Each workspace's routes, the heading each screen opens with, and the link
// marked current. A route of the other workspace opens Home, and says so.
const ROUTES = {
  owner: [
    ["#/", "Home", "Home"],
    ["#/proposals", "Proposals", "Proposals"],
    ["#/proposal/2", "Roof repair", "Proposals"],
    ["#/units", "Your units", "Your units"],
    ["#/building", "Building", "Building"],
    ["#/activity", "Activity", "Activity"],
    ["#/no-such-screen", "Home", "Home"],
    ["#/collect", "Home", "Home"],
  ],
  firm: [
    ["#/", "Home", "Home"],
    ["#/proposals", "Proposals", "Proposals"],
    ["#/proposal/2", "Roof repair", "Proposals"],
    ["#/propose", "Propose work", "Proposals"],
    ["#/collect", "Collect levies", "Collect levies"],
    ["#/vendors", "Vendors", "Vendors"],
    ["#/activity", "Activity", "Activity"],
    ["#/units", "Home", "Home"],
  ],
};
const NAV_LABELS = {
  owner: ["Home", "Proposals", "Your units", "Building", "Activity"],
  firm: ["Home", "Proposals", "Collect levies", "Vendors", "Activity"],
};
// Each Workspace navigation on a page (the Sidebar, then the BottomBar),
// as its links' labels and whether each is marked current.
const navs = (html: string) =>
  html
    .split('aria-label="Workspace"')
    .slice(1)
    .map((nav) =>
      [...nav.split("</nav>")[0].matchAll(/<a ([^>]*)>[\s\S]*?<\/svg>([^<]*)<\/a>/g)].map(
        ([, attrs, label]) => ({ label, current: attrs.includes('aria-current="page"') }),
      ),
    );

// The design system's disclosure line, as Building renders it: the Alert's
// title, then its description.
const PRIVACY_LINE =
  "The full record is public on the chain. This page chooses to show only whether each unit is current or in arrears.";

// Building's two FundCards, each as the words a viewer reads, from its
// `data-fund` to the next card.
const fundCards = (html: string) =>
  html
    .split(/data-fund="(?:op|ltm)"/)
    .slice(1)
    .map((card) => text(card.split('<div data-slot="card"')[0].replace(/^[^>]*>/, "")));

// The rows for units other than the viewer's own, as rendered text. React
// writes an empty attribute as `=""`.
function otherUnitRows(html: string) {
  return [
    ...html.matchAll(/<li data-other-unit(?:="")?>([\s\S]*?)<\/li>/g),
  ].map(([, row]) => ({
    text: row
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    statuses: [...row.matchAll(/data-arrears(?:="")?>([^<]*)</g)].map(
      ([, s]) => s,
    ),
  }));
}

describe("Read interface (#72, #149)", () => {
  async function setUp() {
    const { ethers } = await network.getOrCreate();
    const building = await deployBuilding(ethers);
    // The interface's own read path: the log through `replay`, and block
    // timestamps. No contract is called.
    const render = async (
      viewer: string | undefined,
      hash = "#/",
      wallet?: Wallet,
    ) => {
      const derived = await replay(
        ethers.provider,
        building.addresses,
        building.fromBlock,
      );
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      // The viewer's wallet from the token's events, as main.tsx reads it.
      const token = String(building.contracts.token.target);
      const ownWallet = viewer
        ? {
            approved: await standingApproval(ethers.provider, token, building.addresses.levyLedger, viewer, building.fromBlock),
            balance: await walletBalance(ethers.provider, token, viewer, building.fromBlock),
          }
        : undefined;
      const view = buildView(derived, now, viewer, ownWallet, building.signers.firm.address);
      return {
        view,
        html: renderToStaticMarkup(
          createElement(App, { hash, view, wallet, firm: building.signers.firm.address, onConnect: () => {}, onPay: () => {}, onAct: () => {}, onVote: () => {} }),
        ),
      };
    };
    return { ethers, ...building, render };
  }

  it("NFR10: for a unit other than the viewer's own, renders exactly one of {current, in arrears} and no digit", async () => {
    const { signers, render } = await setUp();
    const { alice, bob, carol, stranger } = signers;

    for (const viewer of [alice, bob, carol]) {
      const { view, html } = await render(viewer.address, "#/building");
      const rows = otherUnitRows(html);
      expect(rows).to.have.length(view.otherUnits.length);
      for (const row of rows) {
        expect(row.statuses).to.have.length(1);
        expect(["current", "in arrears"]).to.include(row.statuses[0]);
        // The unit's own name is its only number; nothing else may be.
        const rest = row.text.replace(/^Unit \d+ /, "");
        expect(rest, `${viewer.address}: "${row.text}"`).to.not.match(/\d/);
      }
      // A unit other than the viewer's own carries a status and nothing
      // else, so no amount or date reaches the renderer at all.
      for (const unit of view.otherUnits) {
        expect(Object.keys(unit)).to.deep.equal(["unitId", "status"]);
      }
    }
    // A wallet holding no unit sees no building data at all (ADR-021).
    expect(otherUnitRows((await render(stranger.address, "#/building")).html)).to.deep.equal([]);

    // The case that matters: as alice, carol's unit 4 is in arrears, and the
    // page says so with no amount and no date.
    const { html } = await render(alice.address, "#/building");
    expect(otherUnitRows(html)).to.deep.equal([
      { text: "Unit 3 current", statuses: ["current"] },
      { text: "Unit 4 in arrears", statuses: ["in arrears"] },
    ]);
    // The viewer's own units are named only as a link to Your units.
    expect(text(html)).to.contain("Units 1 and 2 are on Your units");
    expect(text((await render(bob.address, "#/building")).html)).to.contain("Unit 3 is on Your units");

    // The firm's Home counts the due charges and dates the oldest, and names
    // no unit and no amount; its view of a charge carries neither.
    const firm = await render(signers.firm.address, "#/");
    const due = firm.view.toCollect.filter((c) => c.due).map((c) => c.dueDate);
    const levies = text(firm.html.split('id="h-collect"')[1].split('<div data-slot="card"')[0].replace(/^[^>]*>/, ""));
    expect(levies).to.equal(`Levies to collect 2 charges are due. The oldest fell due on ${date(due.reduce((a, b) => (a < b ? a : b)))}. Collect levies`);
    expect(text(firm.html)).to.not.match(/Unit \d/);
    for (const charge of firm.view.toCollect) {
      expect(Object.keys(charge)).to.deep.equal(["chargeId", "dueDate", "due", "issued"]);
    }
    // Collect levies lists the charges by number and dates, and names no
    // unit and no amount.
    const collect = text((await render(signers.firm.address, "#/collect")).html);
    expect(collect).to.contain("#1");
    expect(collect).to.not.match(/Unit \d|NZD/);
  });

  it("FR13: Building lists the approved vendor by name, shortened address and company identifier, and a Work card names it", async () => {
    const { signers, render } = await setUp();
    const vendor = signers.vendor.address;
    const short = `${vendor.slice(0, 6)}…${vendor.slice(-4)}`;
    const { view, html } = await render(signers.alice.address, "#/building");
    expect(view.vendors.map((v) => [v.payee, v.name, v.companyId])).to.deep.equal([
      [vendor, "Harbour Lifts Ltd", "DEMO-0001"],
    ]);
    // Name first, then the company identifier and the admitting proposal,
    // then the shortened address with Copy.
    const vendors = html.split('id="h-vendors"')[1];
    expect(text(vendors)).to.contain(`Harbour Lifts Ltd DEMO-0001, admitted by proposal #${view.vendors[0].proposalId} ${short} Copy`);
    expect(vendors).to.contain('aria-label="Copy Harbour Lifts Ltd&#x27;s address"');
    // Vendor rows are not unit rows, so NFR10's check never reads them.
    expect(otherUnitRows(html).join()).to.not.contain("Harbour");

    // Proposal 2 pays the vendor: its card names it, then its address and
    // company identifier, as interface.md §4 has every vendor appear.
    const proposals = (await render(signers.alice.address, "#/proposals")).html;
    expect(proposals).to.contain(`<span>Harbour Lifts Ltd</span><span class="font-mono text-[0.9375rem]">${short}</span><span>DEMO-0001</span><span class="tabular-nums">Up to NZD 400.00</span>`);
  });

  it("shows the viewer's own arrears, and stops surfacing a resolved arrear (R4)", async () => {
    const { signers, contracts, render } = await setUp();
    const { alice, bob, carol } = signers;
    // An overdue charge on Your units: its Alert, with the date the firm
    // collected it.
    const overdue =
      /Charge #1 was not covered when the firm collected it on \d{1,2} [A-Z][a-z]{2} \d{4}/;

    // Alice's unit 2 is overdue: her own page gives the amount and due date.
    let { view, html } = await render(alice.address, "#/units");
    expect(view.ownUnits.map((u) => [u.unitId, u.status])).to.deep.equal([
      [1n, "current"],
      [2n, "in arrears"],
    ]);
    expect(view.ownUnits[1].charges.map((c) => c.chargeId)).to.deep.equal([1n]);
    expect(html).to.match(overdue);

    // Bob paid unit 3's charge late. That arrear is resolved, so it is
    // surfaced nowhere: not on his own page, not on anyone else's.
    ({ view } = await render(bob.address, "#/units"));
    expect(view.ownUnits).to.deep.equal([
      { unitId: 3n, status: "current", charges: [] },
    ]);

    // Alice pays by hand. Her arrear stops being surfaced to her and to
    // others.
    await contracts.token.connect(alice).approve(contracts.ledger.target, 250n * 10n ** 18n);
    await contracts.ledger.connect(alice).payLevy(1);
    ({ view, html } = await render(alice.address, "#/units"));
    expect(view.ownUnits[1]).to.deep.equal({
      unitId: 2n,
      status: "current",
      charges: [],
    });
    expect(html).to.not.match(overdue);
    expect(html).to.not.contain(">#1<");
    expect(html).to.not.contain("in arrears");
    ({ view } = await render(carol.address, "#/units"));
    expect(view.otherUnits.find((u) => u.unitId === 2n)?.status).to.equal(
      "current",
    );
  });

  describe("Your units (#153)", () => {
    const unit = (view: Awaited<ReturnType<typeof buildView>>, id: bigint) =>
      view.ownUnits.find((u) => u.unitId === id)!;

    it("lists every unpaid charge of the viewer's units, collected or not yet, and no one else's", async () => {
      const { signers, render } = await setUp();
      const { view, html } = await render(signers.alice.address, "#/units");
      // Unit 1 has a charge scheduled for later; unit 2's collection was not
      // covered, and it is overdue. Unit 1's charge 0 was paid by hand before
      // its due date, so it is gone.
      expect(unit(view, 1n).charges).to.deep.equal([
        {
          chargeId: 4n,
          amount: 250n * 10n ** 18n,
          dueDate: unit(view, 1n).charges[0].dueDate,
          collected: undefined,
          due: false,
          overdue: false,
        },
      ]);
      expect(unit(view, 2n).charges.map((c) => [c.chargeId, c.collected !== undefined, c.due, c.overdue])).to.deep.equal([
        [1n, true, true, true],
      ]);
      expect(unit(view, 1n).status).to.equal("current");
      // One card per unit, its StatusBadge, and a row per charge: number,
      // due date, amount, state and Pay.
      const card = (n: number) => html.split(`id="h-unit-${n}"`)[1].split('<div data-slot="card"')[0];
      const rows = (n: number) =>
        [...card(n).matchAll(/<tr data-slot="table-row"[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map(([, row]) => text(row));
      expect(card(1)).to.contain('data-tone="ok">current</span>');
      expect(card(2)).to.contain('data-tone="late">in arrears</span>');
      expect(rows(1)).to.deep.equal([`#4 ${date(unit(view, 1n).charges[0].dueDate)} NZD 250.00 Scheduled Pay early`]);
      expect(rows(2)).to.deep.equal([`#1 ${date(unit(view, 2n).charges[0].dueDate)} NZD 250.00 in arrears Pay now`]);
      // Below 800px the Table is hidden, and each charge is a stacked row:
      // number and amount, then due date and state, then Pay full width.
      const stacked = (n: number) =>
        [...card(n).matchAll(/<li class="flex flex-col gap-2">([\s\S]*?)<\/li>/g)].map(([, row]) => text(row));
      expect(card(1)).to.match(/<div class="max-wide:hidden"><div data-slot="table-container"/);
      expect(card(1)).to.match(/<ul class="[^"]*wide:hidden">/);
      expect(stacked(1)).to.deep.equal([`#4 NZD 250.00 Due ${date(unit(view, 1n).charges[0].dueDate)} Scheduled Pay early`]);
      expect(stacked(2)).to.deep.equal([`#1 NZD 250.00 Due ${date(unit(view, 2n).charges[0].dueDate)} in arrears Pay now`]);
      expect(card(2)).to.match(/<li class="flex flex-col gap-2">[\s\S]*?<button [^>]*class="[^"]*w-full[^"]*"[^>]*>[\s\S]*?Pay now<\/button><\/li>/);
      expect(text(card(2))).to.match(/Charge #1 was not covered when the firm collected it on \d{1,2} [A-Z][a-z]{2} \d{4} Pay it now to clear the arrear\./);
      expect(text(card(1))).to.not.contain("not covered");
      // Pay sits beside "Signed in your wallet." and the rules it needs.
      for (const n of [1, 2]) {
        expect(card(n)).to.contain("Signed in your wallet.");
        expect(card(n)).to.match(/<\/svg>Rules<\/button>/);
      }
      // Carol's unit 4 is in arrears, and alice sees nothing but its status.
      expect(view.ownUnits.map((u) => u.unitId)).to.deep.equal([1n, 2n]);
      expect(html).to.not.contain("Charge #3");
    });

    it("pays a scheduled charge before it is issued, and an overdue one, approve then payLevy", async () => {
      const { signers, contracts, addresses, render } = await setUp();
      const { alice } = signers;
      // Alice's balance went on charge 0; the interface's ABI does the rest.
      await contracts.token.mint(alice.address, 500n * 10n ** 18n);
      const token = new Contract(String(contracts.token.target), ABI, alice);
      const ledger = new Contract(addresses.levyLedger, ABI, alice);
      for (const [chargeId, amount] of [
        [4n, 250n * 10n ** 18n],
        [1n, 250n * 10n ** 18n],
      ]) {
        await (await token.approve(addresses.levyLedger, amount)).wait();
        await (await ledger.payLevy(chargeId)).wait();
      }
      const { view, html } = await render(alice.address, "#/units");
      expect(view.ownUnits.map((u) => [u.status, u.charges])).to.deep.equal([
        ["current", []],
        ["current", []],
      ]);
      expect(html).to.not.match(/Pay (now|early)/);
      expect(html.match(/No unpaid charges\./g)).to.have.length(2);
    });

    it("offers Pay on Your units and not on Home", async () => {
      const { signers, render } = await setUp();
      const units = await render(signers.alice.address, "#/units");
      const home = await render(signers.alice.address, "#/");
      // Two charges, each in the Table and in the stacked rows.
      expect(units.html.match(/>Pay (now|early)</g)).to.have.length(4);
      expect(home.html).to.not.match(/Pay (now|early)/);
      // Home names the arrear only: unit 2's charge #1, not unit 1's
      // scheduled #4.
      expect(home.html).to.not.contain("Charge #4");
      expect(home.html).to.contain("Charge #1 was not covered when it was collected.");
      expect(units.html).to.contain(">#4<");
    });

    it("disables every other Pay while one payment is in progress", async () => {
      const { signers, render } = await setUp();
      const { view } = await render(signers.alice.address, "#/units");
      const html = renderToStaticMarkup(
        createElement(App, {
          hash: "#/units",
          view,
          onPay: () => {},
          onDebit: () => {},
          paying: 1n,
        }),
      );
      // Charge 1 shows the wait; charge 4's Pay stays but cannot be pressed,
      // and nor can the direct debit's approval.
      expect(html).to.contain("Waiting for your wallet…");
      expect(html).to.match(/<button [^>]*aria-disabled="true">Pay early<\/button>/);
      expect(html).to.match(/<button [^>]*aria-disabled="true"><svg[^>]*>[\s\S]*?<\/svg>Set up direct debit<\/button>/);
      expect(html.match(/<button [^>]*>(?:<svg[^>]*>[\s\S]*?<\/svg>)?(?:Pay|Approve)/g)!.every((b) => b.includes('aria-disabled="true"'))).to.equal(true);
    });

    it("gives a levy payment's signing sentence the two signatures it needs", () => {
      // The Dialog renders through a portal, which react-dom/server leaves
      // out, so this checks the words it ends its sentence with.
      const { signing } = payment(14n, 57n, 1240n * 10n ** 18n);
      expect(signing).to.contain("Two signatures are needed");
      expect(signing).to.contain("Charge #57");
      expect(signing).to.contain("NZD 1,240.00");
    });
  });

  describe("Firm workspace (#157)", () => {
    const DAY = 24n * 60n * 60n;
    const CONTROLS = /<(?:input|textarea|select)\b|type="submit"/g;
    // A firm screen (Vendors unless `hash` says otherwise) as `viewer` sees it, with the firm's address from the deployment file.
    // `onFirm` is given as App gives it to the firm's wallet.
    async function firmPage(s: Awaited<ReturnType<typeof setUp>>, viewer?: string, wallet?: Wallet, hash = "#/vendors") {
      const { view } = await s.render(viewer, hash);
      const html = renderToStaticMarkup(
        createElement(App, {
          hash, view, wallet, firm: s.signers.firm.address,
          onFirm: { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} },
        }),
      );
      return { view, html };
    }
    // Proposal 2 passed and queued: its wait ends at the returned time.
    async function queueRoofRepair(s: Awaited<ReturnType<typeof setUp>>) {
      const { governance } = s.contracts;
      await governance.connect(s.signers.bob).castVote(2, true);
      await advance(s.ethers, await governance.VOTING_PERIOD());
      await governance.connect(s.signers.stranger).queue(2);
      return (await firmPage(s, s.signers.firm.address)).view.toConfirm[0].eta;
    }

    it("FR16, FR17: enables the forms for the firm's wallet, and no other address reaches them (ADR-021)", async () => {
      const s = await setUp();
      const { firm, alice, stranger } = s.signers;
      const own = await firmPage(s, firm.address);
      expect(own.html).to.not.contain('disabled=""');
      expect(own.html).to.contain("Management firm");
      expect(own.html.match(CONTROLS)).to.have.length(4);
      for (const viewer of [alice.address, stranger.address, undefined]) {
        const { html } = await firmPage(s, viewer);
        expect(html.match(CONTROLS), String(viewer)).to.equal(null);
        expect(html).to.not.contain("Propose a vendor");
        expect(html).to.not.contain("Management firm");
      }
      // No firm in the config and no viewer must not match each other.
      const { view } = await s.render(undefined, "#/");
      const none = renderToStaticMarkup(createElement(App, { hash: "#/", view, onFirm: { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} } }));
      expect(none.match(CONTROLS)).to.equal(null);
      // The firm's wallet on another chain is offered nothing.
      const wrong = { kind: "browser", account: firm.address, chainId: 1n, deploymentChainId: 31337n } as const;
      expect((await firmPage(s, firm.address, wrong)).html).to.contain('disabled=""');
    });

    describe("Propose work (#183)", () => {
      const FIRM_ACTS = { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} };
      it("UC3, FR17: a Breadcrumb back to Proposals, Rules by the title, the five fields with no helper text, and Propose beside Signed in your wallet.", async () => {
        const s = await setUp();
        const { view, html } = await firmPage(s, s.signers.firm.address, undefined, "#/propose");
        expect(html).to.match(/<a [^>]*href="#\/proposals"[^>]*>Proposals<\/a>[\s\S]*?aria-current="page"[^>]*>Propose work</);
        expect(html).to.match(/<h1>Propose work<\/h1><button[^>]*>[\s\S]*?<\/svg>Rules<\/button>/);
        expect(PROPOSE_RULES).to.have.length(7);
        const form = html.split('<form aria-label="Propose work"')[1].split("</form>")[0].replace(/^[^>]*>/, "");
        const companyId = view.vendors[0].companyId;
        expect(text(form)).to.equal(`What the work is Vendor Harbour Lifts Ltd ${companyId} Limit Paid from Operating Long-term maintenance Quote hash Propose Signed in your wallet.`);
        expect(form).to.not.contain('disabled=""');
        // The fund is a radio group, Operating first and chosen.
        expect(form).to.match(/role="radiogroup"[^>]*aria-labelledby="fund-l"/);
        expect(form).to.match(/<button type="button" role="radio" aria-checked="true"[^>]*value="0"/);
      });

      it("offers only admitted vendors, by name and identifier, and none until one is admitted", async () => {
        const s = await setUp();
        const { governance } = s.contracts;
        // Proposed but not admitted: it must not be offered.
        await governance.connect(s.signers.firm).getFunction("propose(address,string,string)")(s.signers.alice.address, "Lift Co", "NZBN 1");
        const { view, html } = await firmPage(s, s.signers.firm.address, undefined, "#/propose");
        expect(view.vendors.map((v) => v.payee)).to.deep.equal([s.signers.vendor.address]);
        expect(html).to.not.contain("Lift Co");
        const none = renderToStaticMarkup(createElement(ProposeWork, { vendors: [], act: FIRM_ACTS }));
        expect(none).to.contain("No vendor is approved yet.");
        expect(none).to.match(/role="combobox"[^>]*disabled=""/);
      });

      it("is drawn disabled on the wrong chain, and waits on the wallet while proposing", async () => {
        const s = await setUp();
        const wrong = { kind: "browser", account: s.signers.firm.address, chainId: 1n, deploymentChainId: 31337n } as const;
        const { view, html } = await firmPage(s, s.signers.firm.address, wrong, "#/propose");
        expect(html).to.match(/<button[^>]*type="submit"[^>]*disabled=""/);
        const busy = renderToStaticMarkup(createElement(ProposeWork, { vendors: view.vendors, act: FIRM_ACTS, acting: { action: "work", id: 0n } }));
        expect(busy).to.match(/<button[^>]*type="submit"[^>]*aria-disabled="true"/);
        expect(text(busy)).to.not.contain("Propose Signed");
      });
    });

    describe("Vendors (#185)", () => {
      const FIRM_ACTS = { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} };
      // A card of the screen, from its heading to the end of its card.
      const card = (html: string, id: string) => html.split(`id="${id}"`)[1].split(/<\/form>|<div data-slot="card"|<\/main>/)[0].replace(/^[^>]*>/, "");

      it("FR12, FR15, FR16: approved vendors by name, identifier, admission date and proposal, then the shortened address with Copy; Propose a vendor's three fields and Propose vendor beside Signed in your wallet.", async () => {
        const s = await setUp();
        const { view, html } = await firmPage(s, s.signers.firm.address);
        const [v] = view.vendors;
        expect(html).to.match(/<h1>Vendors<\/h1><div class="grid/);
        expect(text(card(html, "h-vendors"))).to.equal(
          `Approved vendors 1 vendor Rules Harbour Lifts Ltd DEMO-0001, admitted ${date(v.approvedAt)} by proposal #${v.proposalId} ${short(v.payee)} Copy`,
        );
        expect(html).to.contain('aria-label="Copy Harbour Lifts Ltd&#x27;s address"');
        expect(html).to.match(/<form aria-labelledby="h-new-vendor"/);
        expect(text(card(html, "h-new-vendor"))).to.equal("Propose a vendor Rules Name Company identifier Wallet address Propose vendor Signed in your wallet.");
        expect(LIST_RULES).to.deep.equal(["Work can be paid only to a vendor owners admitted by vote.", "No vendor can be removed."]);
        expect(PROPOSE_VENDOR_RULES).to.have.length(2);
      });

      it("says no vendor is approved yet, is drawn disabled on the wrong chain, and waits on the wallet while proposing", async () => {
        const none = renderToStaticMarkup(createElement(Vendors, { vendors: [], act: FIRM_ACTS }));
        expect(text(card(none, "h-vendors"))).to.equal("Approved vendors Rules No vendor is approved yet.");
        const s = await setUp();
        const wrong = { kind: "browser", account: s.signers.firm.address, chainId: 1n, deploymentChainId: 31337n } as const;
        const { view, html } = await firmPage(s, s.signers.firm.address, wrong);
        expect(html).to.match(/<button[^>]*type="submit"[^>]*disabled=""/);
        expect(html.match(/<input[^>]*disabled=""/g)).to.have.length(3);
        const busy = renderToStaticMarkup(createElement(Vendors, { vendors: view.vendors, act: FIRM_ACTS, acting: { action: "vendor", id: 0n } }));
        expect(busy).to.match(/<button[^>]*type="submit"[^>]*aria-disabled="true"/);
        expect(text(busy)).to.contain("Waiting for your wallet…");
        expect(text(busy)).to.not.contain("Propose vendor");
      });
    });

    describe("Collect levies (#184)", () => {
      const FIRM_ACTS = { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} };
      // A card of the screen, from its heading to the next card.
      const card = (html: string, id: string) => html.split(`id="${id}"`)[1].split(/<div data-slot="card"|<\/main>/)[0].replace(/^[^>]*>/, "");

      it("ADR-020: Due now lists the due charges by number, due date and when issued, every one selected, with Rules and Collect beside Signed in your wallet.; Coming due dates the next", async () => {
        const s = await setUp();
        const { view, html } = await firmPage(s, s.signers.firm.address, undefined, "#/collect");
        // Charges 1 and 3 were collected and not covered; 4 is not yet due.
        const [one, three, four] = view.toCollect;
        expect(view.toCollect.map((c) => [c.chargeId, c.due, c.issued !== undefined])).to.deep.equal([
          [1n, true, true],
          [3n, true, true],
          [4n, false, false],
        ]);
        // No subtitle: the title, then the cards.
        expect(html).to.match(/<h1>Collect levies<\/h1><div data-slot="card"/);
        const due = card(html, "h-due");
        expect(text(due)).to.equal(
          `Due now 2 charges Rules Charge Due Issued #1 ${date(one.dueDate)} ${date(one.issued!)}, not covered #3 ${date(three.dueDate)} ${date(three.issued!)}, not covered Collect 2 charges Signed in your wallet.`,
        );
        // The header's box and one per due charge, all ticked; none for
        // charge 4, which cannot be collected before its date.
        expect(due.match(/role="checkbox" aria-checked="true"/g)).to.have.length(3);
        expect(due).to.not.contain("Charge #4");
        expect(due).to.not.contain('disabled=""');
        expect(text(card(html, "h-coming"))).to.equal(`Coming due 1 charge falls due on ${date(four.dueDate)}.`);
        // The log cannot say what the last collection did (interface.md §4).
        expect(html).to.not.contain("Last collection");
        expect(COLLECT_RULES).to.have.length(6);
        expect(COLLECT_RULES).to.include("A retry that is still not covered leaves no record.");
      });

      it("says no charge is due and offers nothing once all are collected, is drawn disabled on the wrong chain, and waits on the wallet while collecting", async () => {
        const s = await setUp();
        const wrong = { kind: "browser", account: s.signers.firm.address, chainId: 1n, deploymentChainId: 31337n } as const;
        const { view, html } = await firmPage(s, s.signers.firm.address, wrong, "#/collect");
        expect(html).to.match(/<button[^>]*disabled=""[^>]*>[\s\S]*?Collect 2 charges<\/button>/);
        expect(html.match(/role="checkbox"[^>]*disabled=""/g)).to.have.length(3);
        const busy = renderToStaticMarkup(createElement(CollectLevies, { toCollect: view.toCollect, act: FIRM_ACTS, acting: { action: "collect", id: 0n } }));
        expect(busy).to.match(/<button[^>]*aria-disabled="true"[^>]*>/);
        expect(text(busy)).to.contain("Waiting for your wallet…");
        // Carol funds and approves her charge, and the firm collects both.
        const { carol, firm } = s.signers;
        await s.contracts.token.mint(carol.address, 250n * 10n ** 18n);
        await (await new Contract(String(s.contracts.token.target), ABI, carol).approve(s.addresses.levyLedger, 250n * 10n ** 18n)).wait();
        const alice = s.signers.alice;
        await s.contracts.token.mint(alice.address, 250n * 10n ** 18n);
        await (await new Contract(String(s.contracts.token.target), ABI, alice).approve(s.addresses.levyLedger, 500n * 10n ** 18n)).wait();
        await (await new Contract(s.addresses.levyLedger, ABI, firm).collect([1n, 3n])).wait();
        const none = (await firmPage(s, firm.address, undefined, "#/collect")).html;
        expect(text(card(none, "h-due"))).to.equal("Due now No charge is due. Rules");
        expect(none).to.not.contain("Signed in your wallet.");
        expect(none).to.not.contain('class="border-2');
      });
    });

    it("ADR-020: collect through tx.ts's ABI takes a direct-debited levy and leaves an uncovered one owed", async () => {
      const s = await setUp();
      const { firm, alice, carol } = s.signers;
      await advance(s.ethers, 31n * DAY);
      // Alice sets up direct debit for her two unpaid charges; carol does not.
      await s.contracts.token.mint(alice.address, 250n * 10n ** 18n);
      const token = new Contract(String(s.contracts.token.target), ABI, alice);
      await (await token.approve(s.addresses.levyLedger, 500n * 10n ** 18n)).wait();
      const ledger = new Contract(s.addresses.levyLedger, ABI, firm);
      // The toast counts the call's own LevyPaid logs.
      expect((await outcome(collectLevies(3), () => ledger.collect([1n, 3n, 4n]))).toast).to.deep.equal({
        title: "Levies collected",
        body: "2 collected, 1 not covered.",
      });
      // A retry still not covered: the toast says so, and the log gains
      // nothing (interface.md §4).
      const before = (await s.render(firm.address, "#/activity")).view.activity.length;
      expect((await outcome(collectLevies(1), () => ledger.collect([3n]))).toast).to.deep.equal({
        title: "Levies collected",
        body: "0 collected, 1 not covered.",
      });
      expect((await s.render(firm.address, "#/activity")).view.activity).to.have.length(before);

      const own = await s.render(alice.address, "#/units");
      expect(own.view.ownUnits.map((u) => [u.unitId, u.status, u.charges.length])).to.deep.equal([
        [1n, "current", 0],
        [2n, "current", 0],
      ]);
      const { view } = await firmPage(s, firm.address);
      expect(view.toCollect.map((c) => [c.chargeId, c.issued !== undefined])).to.deep.equal([[3n, true]]);
      expect((await s.render(carol.address, "#/units")).view.ownUnits[0].status).to.equal("in arrears");
    });

    it("ADR-020: paying one charge by hand leaves the direct debit standing for the rest, rebuilt from events alone", async () => {
      const s = await setUp();
      const { firm, alice } = s.signers;
      const UNIT = 10n ** 18n;
      const token = new Contract(String(s.contracts.token.target), ABI, alice);
      const ledger = new Contract(s.addresses.levyLedger, ABI, alice);
      const standing = () =>
        standingApproval(s.ethers.provider, String(s.contracts.token.target), s.addresses.levyLedger, alice.address, s.fromBlock);
      // The events agree with the token's own count at every step.
      const agrees = async () =>
        expect(await standing()).to.equal(await s.contracts.token.allowance(alice.address, s.addresses.levyLedger));
      await agrees();
      // Alice sets up direct debit for charges 1 and 4, then pays charge 1 by
      // hand as main.tsx's Pay does: the standing approval plus the charge.
      await s.contracts.token.mint(alice.address, 250n * UNIT);
      await (await token.approve(s.addresses.levyLedger, 500n * UNIT)).wait();
      await agrees();
      await (await token.approve(s.addresses.levyLedger, (await standing()) + 250n * UNIT)).wait();
      await (await ledger.payLevy(1n)).wait();
      expect(await standing()).to.equal(500n * UNIT);
      await agrees();
      // Charge 4 falls due, and the firm's collection still takes it.
      await advance(s.ethers, 31n * DAY);
      await (await new Contract(s.addresses.levyLedger, ABI, firm).collect([4n])).wait();
      expect((await s.render(alice.address, "#/units")).view.ownUnits.flatMap((u) => u.charges)).to.deep.equal([]);
      expect(await standing()).to.equal(250n * UNIT);
      await agrees();
    });

    it("interface.md §3: rebuilds the direct debit and the wallet balance from MockNZD's events, as the token itself counts them", async () => {
      const s = await setUp();
      const { alice, bob, firm } = s.signers;
      const { token } = s.contracts;
      const UNIT = 10n ** 18n;
      // What Your units is given, against the token's own allowance and
      // balance. Only the test calls the token; the interface reads logs.
      const agrees = async () =>
        expect((await s.render(alice.address, "#/units")).view.ownWallet).to.deep.equal({
          approved: await token.allowance(alice.address, s.addresses.levyLedger),
          balance: await token.balanceOf(alice.address),
        });
      await agrees();
      // A mint and plain transfers, which no levy event records.
      await token.mint(alice.address, 300n * UNIT);
      await token.connect(alice).transfer(bob.address, 40n * UNIT);
      await token.connect(bob).transfer(alice.address, 15n * UNIT);
      await agrees();
      // Direct debit through tx.ts's ABI, then the firm takes charge 1, late,
      // and charge 4 once it falls due.
      await (await new Contract(String(token.target), ABI, alice).approve(s.addresses.levyLedger, 500n * UNIT)).wait();
      await agrees();
      const ledger = new Contract(s.addresses.levyLedger, ABI, firm);
      await (await ledger.collect([1n])).wait();
      await agrees();
      await advance(s.ethers, 31n * DAY);
      await (await ledger.collect([4n])).wait();
      await agrees();
      // The Direct debit card and Home show the same two figures.
      const { view, html } = await s.render(alice.address, "#/units");
      const { approved, balance } = view.ownWallet!;
      expect([approved, balance]).to.deep.equal([0n, 25n * UNIT]);
      const card = html.split('id="h-debit"')[1].split('<div data-slot="card"')[0];
      expect(text(card)).to.contain(`Scheduled total NZD 0.00 Approved ${nzd(approved)} Wallet balance ${nzd(balance)}`);
      const home = (await s.render(alice.address, "#/")).html;
      expect(text(home)).to.contain(`Direct debit approved for ${nzd(approved)} Wallet balance ${nzd(balance)}`);
    });

    it("ADR-020: Set up direct debit approves the levy ledger for the owner's unpaid total", async () => {
      const s = await setUp();
      const units = async (viewer: string, props: object = {}) =>
        renderToStaticMarkup(
          createElement(App, { hash: "#/units", view: (await s.render(viewer, "#/units")).view, onDebit() {}, ...props }),
        );
      // Alice's unpaid charges are 1 and 4, NZD 250.00 each.
      const html = await units(s.signers.alice.address);
      const card = html.split('id="h-debit"')[1].split('<div data-slot="card"')[0];
      expect(text(card)).to.contain("Scheduled total NZD 500.00");
      expect(card).to.match(/<button [^>]*><svg[^>]*>[\s\S]*?<\/svg>Set up direct debit<\/button>/);
      expect(card).to.contain("Signed in your wallet.");
      expect(await units(s.signers.stranger.address)).to.not.contain("Set up direct debit");
      const busy = await units(s.signers.alice.address, { acting: { action: "debit", id: 0n } });
      expect(busy).to.contain("Waiting for your wallet…");
      expect(busy).to.not.contain("Set up direct debit");
    });

    it("FR17: proposes work and a vendor through tx.ts's ABI, and both appear in the replayed View", async () => {
      const s = await setUp();
      const { firm, vendor, carol } = s.signers;
      const asFirm = new Contract(s.addresses.governance, ABI, firm);
      // What the form hands over once its checks pass.
      const { work } = checkWork({ description: "Paint the stairwell", cap: "1,800.50", fund: "1", vendor: vendor.address, quote: id("quote: paint") });
      expect(work).to.deep.equal({ description: "Paint the stairwell", limit: parseUnits("1800.50", 18), fund: 1, vendor: vendor.address, quoteHash: id("quote: paint") });
      const worked = await outcome(proposeWork(work!.description), () =>
        asFirm.getFunction("propose(string,uint256,uint8,address,bytes32)")(work!.description, work!.limit, work!.fund, work!.vendor, work!.quoteHash));
      expect(worked.toast).to.deep.equal({ title: "Work proposed", body: "“Paint the stairwell” is proposed for owners to vote on." });
      const { vendor: admit } = checkVendor({ name: "Stair Paint Ltd", companyId: "NZBN 9", wallet: carol.address });
      const admitted = await outcome(proposeVendor(admit!.name), () =>
        asFirm.getFunction("propose(address,string,string)")(admit!.vendor, admit!.name, admit!.companyId));
      expect(admitted.toast).to.deep.equal({ title: "Vendor proposed", body: "Stair Paint Ltd is proposed as a vendor for owners to vote on." });
      const { view } = await s.render(firm.address, "#/");
      const [paint, stair] = view.proposals.slice(-2);
      expect([paint.kind, paint.description, paint.limit, paint.fund, paint.payee]).to.deep.equal(["Work", "Paint the stairwell", work!.limit, 1n, vendor.address]);
      expect([stair.kind, stair.description, stair.payee]).to.deep.equal(["Admit", "Stair Paint Ltd", carol.address]);
    });

    it("NotFirm, VendorNameIsEmpty and CompanyIdIsEmpty show their RefusalNotice messages", async () => {
      const s = await setUp();
      const { firm, stranger, carol, vendor } = s.signers;
      const asStranger = new Contract(s.addresses.governance, ABI, stranger);
      const refused = await outcome(proposeWork("Roof"), () =>
        asStranger.getFunction("propose(string,uint256,uint8,address,bytes32)")("Roof", 1n, 0, vendor.address, id("q")));
      expect(refused.notice).to.deep.equal({ variant: "destructive", title: "The work was not proposed", description: "Only the management firm’s wallet can do this.", code: "NotFirm" });
      const asFirm = new Contract(s.addresses.governance, ABI, firm);
      const empty = await outcome(proposeVendor(""), () => asFirm.getFunction("propose(address,string,string)")(carol.address, "", "NZBN 9"));
      expect(empty.notice).to.deep.equal({ variant: "destructive", title: "The vendor was not proposed", description: "Add the vendor's name before proposing.", code: "VendorNameIsEmpty" });
      const noId = await outcome(proposeVendor("X"), () => asFirm.getFunction("propose(address,string,string)")(carol.address, "X", ""));
      expect(noId.notice).to.deep.equal({ variant: "destructive", title: "The vendor was not proposed", description: "Add the vendor's company identifier before proposing.", code: "CompanyIdIsEmpty" });
    });

    it("lists only queued Work proposals the firm has not confirmed, and no Admit proposal", async () => {
      const s = await setUp();
      // Open: not listed. Proposal 1 (Admit, executed) never is.
      expect((await s.render(s.signers.firm.address)).view.toConfirm).to.deep.equal([]);
      await queueRoofRepair(s);
      expect((await s.render(s.signers.firm.address)).view.toConfirm.map((c) => c.id)).to.deep.equal([2n]);
    });

    describe("Firm Home (#182)", () => {
      // Each card on the firm's Home, as the words a viewer reads and the
      // proposal each row links to.
      async function home(s: Awaited<ReturnType<typeof setUp>>) {
        const { html } = await s.render(s.signers.firm.address, "#/");
        // No owner action and no owner navigation (ADR-021): no form, no
        // button but the Rules trigger, no link to an owner's screen.
        expect(html).to.not.match(/<form|Vote|Pay|Your levies|href="#\/(?:units|building)"/);
        expect([...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => text(b))).to.deep.equal(["Rules"]);
        const card = (id: string) => html.split(`id="${id}"`)[1].split('<div data-slot="card"')[0].replace(/^[^>]*>/, "");
        const rowsOf = (id: string) =>
          [...card(id).matchAll(/<li><a href="#\/proposal\/(\d+)"[^>]*>([\s\S]*?)<\/a><\/li>/g)].map(([, n, row]) => `#${n} ${text(row)}`);
        return {
          html,
          confirm: rowsOf("h-confirm"),
          ready: rowsOf("h-ready"),
          voting: [...card("h-voting").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1).map(([, row]) => text(row)),
          card: (id: string) => text(card(id)),
        };
      }

      it("is titled Home with no subtitle, links to Collect levies and Propose work, and has Rules on Ready to carry out", async () => {
        const s = await setUp();
        const { html } = await home(s);
        expect(text(html.split("<h1>")[1].split('<div data-slot="card"')[0])).to.equal("Home");
        expect(html.split('id="h-collect"')[1]).to.match(/^[\s\S]*?<a [^>]*href="#\/collect"[^>]*>[\s\S]*?Collect levies<\/a>/);
        expect(html.split('id="h-voting"')[1]).to.match(/^[\s\S]*?<a [^>]*href="#\/propose"[^>]*>[\s\S]*?Propose work<\/a>/);
        expect(html.split('id="h-ready"')[1].split('<div data-slot="card"')[0]).to.contain("Rules</button>");
      });

      it("lists work to confirm and proposals ready to carry out from ProposalQueued and WorkAttested, each linking to its Proposal, and the firm's proposals in voting with quorum and closing date", async () => {
        const s = await setUp();
        const { governance } = s.contracts;
        const { firm, alice, bob, stranger } = s.signers;
        const roof = s.render(firm.address).then(({ view }) => view.proposals.find((p) => p.id === 2n)!);
        let h = await home(s);
        expect(h.confirm).to.deep.equal([]);
        expect(h.card("h-confirm")).to.equal("Work to confirm No work is waiting to be confirmed.");
        expect(h.card("h-ready")).to.equal("Ready to carry out Rules Nothing is ready to carry out.");
        // Alice's two units voted; one owner of the two quorum needs.
        expect(h.voting).to.deep.equal([`Roof repair Open 1 unit voted; 1 needed met 1 owner voted; 2 needed not yet met ${date((await roof).closes!)}`]);
        // Each condition with its own StatusBadge.
        expect(h.html.split('id="h-voting"')[1]).to.match(/1 unit voted; 1 needed<span [^>]*data-tone="ok">met<\/span>[\s\S]*?1 owner voted; 2 needed<span [^>]*data-tone="wait">not yet met<\/span>/);
        expect(h.html).to.not.match(/\d+ of \d+ (units|owners)/);
        expect(h.html).to.contain('<a href="#/proposal/2">Roof repair</a>');

        // Proposal 3 admits a vendor and passes; proposal 2 misses quorum
        // and is extended.
        await governance.connect(firm).getFunction("propose(address,string,string)")(stranger.address, "Lift Co", "NZBN 1");
        await governance.connect(alice).castVote(3, true);
        await governance.connect(bob).castVote(3, true);
        await advance(s.ethers, await governance.VOTING_PERIOD());
        h = await home(s);
        expect(h.voting).to.deep.equal([`Roof repair Extended Quorum waived. One owner&#x27;s vote can decide. ${date((await s.render(firm.address)).view.proposals[1].closes!)}`]);

        await governance.connect(bob).castVote(2, true);
        await advance(s.ethers, await governance.EXTENSION());
        await governance.connect(stranger).queue(2);
        await governance.connect(stranger).queue(3);
        const { view } = await s.render(firm.address);
        const eta = (id: bigint) => date(view.proposals.find((p) => p.id === id)!.eta!);
        h = await home(s);
        expect(h.voting).to.deep.equal([]);
        expect(h.card("h-voting")).to.contain("No proposals are open for voting.");
        expect(h.confirm).to.deep.equal([`#2 Roof repair Harbour Lifts Ltd Wait ends ${eta(2n)} Queued`]);
        expect(h.ready).to.deep.equal([]);

        await advance(s.ethers, await governance.TIMELOCK_DELAY());
        h = await home(s);
        expect(h.confirm).to.deep.equal([`#2 Roof repair Harbour Lifts Ltd Wait ended ${eta(2n)} Confirm work`]);
        expect(h.ready).to.deep.equal([`#3 Admit Lift Co Wait ended ${eta(3n)} Carry out`]);

        await governance.connect(firm).attest(2, id("evidence: roof"));
        const attested = (await s.render(firm.address)).view.proposals[1].steps.find((st) => st.dateLabel === "Confirmed")!.date!;
        h = await home(s);
        expect(h.confirm).to.deep.equal([]);
        expect(h.ready).to.deep.equal([
          `#2 Roof repair Work confirmed ${date(attested)} Up to NZD 400.00 Carry out`,
          `#3 Admit Lift Co Wait ended ${eta(3n)} Carry out`,
        ]);

        await governance.connect(stranger).execute(2);
        await governance.connect(stranger).execute(3);
        expect((await home(s)).ready).to.deep.equal([]);
      });

      it("says one due charge, and none, in its own words", async () => {
        const s = await setUp();
        const ledger = new Contract(s.addresses.levyLedger, ABI, s.signers.firm);
        const { token } = s.contracts;
        const levies = async () => (await home(s)).card("h-collect");
        // Carol's direct debit covers unit 4's charge, then alice's unit 2's.
        await (await token.mint(s.signers.carol.address, 250n * 10n ** 18n)).wait();
        await (await token.connect(s.signers.carol).approve(s.addresses.levyLedger, 250n * 10n ** 18n)).wait();
        await (await ledger.collect([3n])).wait();
        const one = (await s.render(s.signers.firm.address)).view.toCollect.find((c) => c.due)!;
        expect(await levies()).to.equal(`Levies to collect 1 charge is due. It fell due on ${date(one.dueDate)}. Collect levies`);
        await (await token.mint(s.signers.alice.address, 250n * 10n ** 18n)).wait();
        await (await token.connect(s.signers.alice).approve(s.addresses.levyLedger, 500n * 10n ** 18n)).wait();
        await (await ledger.collect([one.chargeId])).wait();
        expect(await levies()).to.equal("Levies to collect No charge is due. Collect levies");
      });
    });

    it("catches an empty description and a malformed hash, address or cap before anything is sent, and leaves a vendor's emptiness to the contract", () => {
      const ok = { description: "Fix the gutter", cap: "10", fund: "0", vendor: ZERO, quote: id("q") };
      expect(checkWork(ok).work).to.not.equal(undefined);
      // An empty "What the work is" is stopped under its field (#202).
      for (const description of ["", "  "]) {
        expect(checkWork({ ...ok, description }).hints).to.deep.equal({ description: "Add what the work is before proposing." });
      }
      // The limit as the design system writes amounts.
      expect(checkWork({ ...ok, cap: "NZD 48,000.00" }).work?.limit).to.equal(48_000n * 10n ** 18n);
      for (const bad of [
        { quote: "0x1234" }, { quote: "" }, { quote: id("q").slice(0, 65) + "zz".slice(0, 1) },
        { vendor: "0x123" }, { vendor: "" },
        { cap: "" }, { cap: "0" }, { cap: "0.00" }, { cap: "-5" }, { cap: "1e3" }, { cap: "1.0000000000000000001" }, { cap: "ten" },
      ]) {
        const { hints, work } = checkWork({ ...ok, ...bad });
        expect(work, JSON.stringify(bad)).to.equal(undefined);
        expect(Object.keys(hints), JSON.stringify(bad)).to.have.length(1);
      }
      expect(checkVendor({ name: "", companyId: "", wallet: "0xabc" }).hints.wallet).to.be.a("string");
      // Empty name and identifier pass: the contract refuses them in words.
      expect(checkVendor({ name: "", companyId: "", wallet: ZERO }).vendor).to.deep.equal({ vendor: ZERO, name: "", companyId: "" });
      expect(checkEvidence(id("evidence: roof"))).to.equal(undefined);
      expect(checkEvidence("")).to.equal("Add the evidence hash before confirming.");
      expect(checkEvidence("0xabc")).to.be.a("string");
    });
  });

  it("shows fund balances and proposals in the state Governance gives them", async () => {
    const { ethers, contracts, signers, render } = await setUp();
    const { governance } = contracts;
    const treasury = await ethers.getContractAt(
      "Treasury",
      await governance.treasury(),
    );

    const check = async () => {
      const { view } = await render(signers.alice.address);
      // The test's own assertions read the contracts; the interface did not.
      expect(view.funds.operating).to.equal(await treasury.balanceOf(0));
      expect(view.funds.maintenance).to.equal(await treasury.balanceOf(1));
      for (const p of view.proposals) {
        expect(p.state, `proposal ${p.id}`).to.equal(
          STATES[Number(await governance.state(p.id))],
        );
      }
      return view.proposals.map((p) => p.state);
    };
    const advance = async (days: number) => {
      await ethers.provider.send("evm_increaseTime", [days * 86_400]);
      await ethers.provider.send("evm_mine", []);
    };

    // Proposal 2 has alice's vote alone: one wallet, so no quorum at the
    // window's close, and it extends; with quorum waived, one vote for
    // passes it.
    expect(await check()).to.deep.equal(["Executed", "Open"]);
    await advance(14);
    expect(await check()).to.deep.equal(["Executed", "Extended"]);
    await advance(7);
    expect(await check()).to.deep.equal(["Executed", "Passed"]);
  });

  it("FR40: the queued-to-pay figure is the sum of the Queued limits on that fund, from events, and Home lists the queued work with its date", async () => {
    const { ethers, contracts, signers, render } = await setUp();
    const { governance } = contracts;
    let { view, html } = await render(signers.carol.address);
    expect(view.queued).to.deep.equal({ operating: 0n, maintenance: 0n });
    expect(html).to.contain("Nothing is queued to pay.");

    // Bob votes with alice, so quorum holds and the window closes without an
    // extension; anyone then queues it. Carol's unit is in arrears (FR10).
    await governance.connect(signers.bob).castVote(2, true);
    await advance(ethers, await governance.VOTING_PERIOD());
    await governance.connect(signers.stranger).queue(2);
    ({ view, html } = await render(signers.carol.address));
    expect(view.queued).to.deep.equal({
      operating: parseUnits("400", 18),
      maintenance: 0n,
    });
    const eta = view.proposals.find((p) => p.id === 2n)!.steps.find((s) => s.name === "Queued")!.date!;
    const queued = html.split('id="h-queued"')[1].split('id="h-funds"')[0];
    expect(queued).to.contain('<a href="#/proposal/2"');
    expect(queued).to.contain("Roof repair");
    expect(queued).to.contain("Harbour Lifts Ltd");
    expect(queued).to.contain(`Payment possible from ${date(eta)}`);
    // Building's FundCards give the figure on each fund, never summed.
    expect(fundCards((await render(signers.carol.address, "#/building")).html)).to.deep.equal([
      `Operating ${nzd(view.funds.operating)} Queued to pay, at most NZD 400.00`,
      `Long-term maintenance ${nzd(view.funds.maintenance)} Queued to pay, at most NZD 0.00`,
    ]);
  });

  it("lists what needs the viewer's vote, each with the date voting closes", async () => {
    const { ethers, contracts, signers, addresses, fromBlock, render } =
      await setUp();
    const { governance } = contracts;
    const [created] = await ethers.provider.getLogs({
      address: addresses.governance,
      fromBlock,
      topics: [
        governance.interface.getEvent("ProposalCreated").topicHash,
        zeroPadValue("0x02", 32),
      ],
    });
    const createdAt = BigInt(
      (await ethers.provider.getBlock(created.blockNumber))!.timestamp,
    );
    const window = await governance.VOTING_PERIOD();
    const closes = createdAt + window;

    // Bob's unit has not voted on proposal 2. Alice's unit 1 has, and her
    // unit 2 and carol's unit 4 are in arrears, so neither is asked (FR10).
    let { view, html } = await render(signers.bob.address);
    const vote = (page: string) => page.split('id="h-vote"')[1].split('id="h-levies"')[0];
    expect(view.proposals.find((p) => p.id === 2n)?.closes).to.equal(closes);
    expect(vote(html)).to.contain(`Closes ${date(closes)}`);
    // Home links to the proposal and offers no action (interface.md §4).
    expect(vote(html)).to.contain('<a href="#/proposal/2"');
    expect(vote(html)).to.contain("Roof repair");
    expect(vote(html)).to.contain('data-tone="info">Open</span>');
    expect(vote(html)).to.not.contain("Quorum waived");
    expect(html).to.not.contain("<form");
    for (const owner of [signers.alice, signers.carol]) {
      ({ html } = await render(owner.address));
      expect(vote(html)).to.contain("No proposals are open for voting.");
    }

    // One wallet voted, so no quorum: voting extends by seven days, and the
    // waiver stays in sight.
    await advance(ethers, window);
    ({ view, html } = await render(signers.bob.address));
    const extended = closes + 7n * 86_400n;
    expect(view.proposals.find((p) => p.id === 2n)?.closes).to.equal(extended);
    expect(vote(html)).to.contain(`Closes ${date(extended)}`);
    expect(vote(html)).to.contain('data-tone="wait">Extended</span>');
    expect(vote(html)).to.contain("Quorum waived. One owner&#x27;s vote can decide.");
  });

  it("Home names each of the viewer's units in arrears and the next charge, with a Rules button on each card that has rules", async () => {
    const { signers, render } = await setUp();
    const { view, html } = await render(signers.alice.address);
    const levies = html.split('id="h-levies"')[1].split('id="h-queued"')[0];
    // Unit 2 owes charge #1; unit 1 is current and is not named.
    expect(levies).to.contain("Unit 2 is in arrears");
    expect(levies).to.contain("Charge #1 was not covered when it was collected. Pay it to clear the arrear.");
    expect(levies).to.not.contain("Unit 1 is in arrears");
    // The direct debit and the balance, rebuilt from the token's events:
    // alice approved charge 0 alone and paid it, so nothing stands.
    expect(view.ownWallet).to.deep.equal({ approved: 0n, balance: 250n * 10n ** 18n });
    expect(text(levies)).to.contain("Direct debit approved for NZD 0.00 Wallet balance NZD 250.00 Next charge");
    const next = view.ownUnits.flatMap((u) => u.charges).find((c) => !c.overdue)!;
    expect(levies).to.contain(`${nzd(next.amount)} on ${date(next.dueDate)}`);
    expect(levies).to.contain('<a href="#/units"');
    // Needs your vote and Your levies have rules; the other two cards do not.
    expect(html.match(/aria-haspopup="dialog"[^>]*>[\s\S]*?<\/svg>Rules<\/button>/g)).to.have.length(2);
    expect(html).to.not.contain("Unit 3");
    // The guarantees are on Building, the four lines visible and the
    // explanation behind Rules, as the vendors' is.
    const building = (await render(signers.alice.address, "#/building")).html;
    const guarantees = building.split('id="h-guarantees"')[1].split('id="h-units"')[0];
    expect(text(guarantees).replaceAll("&#x27;", "'")).to.contain(GUARANTEES.join(" "));
    expect(guarantees).to.contain("Rules</button>");
    expect(building.split('id="h-vendors"')[1]).to.contain("Rules</button>");
    // No page description: the heading is followed by the first card.
    expect(building).to.match(/<h1>Building<\/h1><div class="grid[^"]*"><div data-slot="card"/);
  });

  it("offers a vote only to a unit that has not voted, and only while voting is open", async () => {
    const { signers, render } = await setUp();
    // Bob's unit has not voted on proposal 2. Alice's unit 1 has, and a
    // unit in arrears is offered no vote: alice's unit 2, carol's unit 4
    // (FR10).
    const at = "#/proposal/2";
    expect((await render(signers.bob.address, at)).html).to.match(
      /<form [^>]*data-proposal="2">/,
    );
    for (const owner of [signers.alice, signers.carol]) {
      expect((await render(owner.address, at)).html).to.not.contain("<form");
    }
    // A wallet with no unit cannot vote at all.
    expect((await render(signers.stranger.address, at)).html).to.not.contain(
      "<form",
    );
  });

  it("FR40: a queued long-term maintenance proposal counts against that fund and not Operating", async () => {
    const { ethers, contracts, signers, render } = await setUp();
    const { governance } = contracts;
    // Proposal 3 pays the admitted vendor from long-term maintenance (fund 1).
    await governance
      .connect(signers.firm)
      .getFunction("propose(string,uint256,uint8,address,bytes32)")(
      "Replace the lift cables",
      parseUnits("900", 18),
      1,
      signers.vendor.address,
      zeroPadValue("0x03", 32),
    );
    for (const owner of [signers.alice, signers.bob]) {
      await governance.connect(owner).castVote(3, true);
    }
    await advance(ethers, await governance.VOTING_PERIOD());
    await governance.connect(signers.stranger).queue(3);
    const { view } = await render(signers.carol.address);
    expect(view.queued).to.deep.equal({
      operating: 0n,
      maintenance: parseUnits("900", 18),
    });
    expect(fundCards((await render(signers.carol.address, "#/building")).html)).to.deep.equal([
      `Operating ${nzd(view.funds.operating)} Queued to pay, at most NZD 0.00`,
      `Long-term maintenance ${nzd(view.funds.maintenance)} Queued to pay, at most NZD 900.00`,
    ]);
  });

  describe("Proposal screen (#178)", () => {
    // The timeline's steps as rendered: [status, name, date line].
    const timeline = (html: string) =>
      [...html.matchAll(/<li data-step="(\w+)"[\s\S]*?<\/li>/g)].map(([li, step]) => {
        const [name, when] = [...li.matchAll(/<span class="block[^"]*">([^<]*)<\/span>/g)].map(([, t]) => t);
        return [step, name, when];
      });
    const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    // A card's markup, by its heading's id.
    const card = (html: string, id: string) =>
      html.split(`aria-labelledby="${id}">`)[1].split(/<div data-slot="card"|<\/main>/)[0];
    // The labels of the action buttons offered: Queue, Confirm work, Carry out.
    const BUTTONS = "Queue for payment|Confirm work|Carry out payment|Carry out";
    const buttons = (html: string) =>
      [...html.matchAll(new RegExp(`<button (?![^>]*aria-disabled)[^>]*>(?:<svg[\\s\\S]*?</svg>)?(${BUTTONS})</button>`, "g"))].map(([, label]) => label);
    const block = async (ethers: any, n: number) =>
      BigInt((await ethers.provider.getBlock(n))!.timestamp);

    // Both quorum conditions, as the log gives them, against the contract's.
    async function expectQuorumMatches(
      ethers: any,
      governance: any,
      view: any,
    ) {
      for (const p of view.proposals) {
        // The state each check is made in is the contract's too.
        expect(p.state, `proposal ${p.id} state`).to.equal(
          STATES[Number(await governance.state(p.id))],
        );
        const stored = await governance.proposal(p.id);
        const tally = await governance.tallyOf(p.id);
        const unitsVoted = tally.forVotes + tally.againstVotes;
        const divisor = await governance.QUORUM_UNIT_DIVISOR();
        const minVoters = await governance.QUORUM_MIN_VOTERS();
        const q = p.quorum;
        expect(q.unitsVoted, `proposal ${p.id} units`).to.equal(unitsVoted);
        expect(q.unitsMet).to.equal(
          unitsVoted * divisor >= stored.principalUnits,
        );
        expect(q.voters).to.equal(await governance.voterCount(p.id));
        expect(q.votersNeeded).to.equal(minVoters);
        expect(q.votersMet).to.equal(q.voters >= minVoters);
        expect(q.unitsMet && q.votersMet, `proposal ${p.id} quorum`).to.equal(
          await governance.quorumReached(p.id),
        );
      }
    }

    it("meters both quorum conditions as Governance.quorumReached does, at every state", async () => {
      const { ethers, contracts, signers, render } = await setUp();
      const { governance } = contracts;
      const states: string[] = [];
      const check = async () => {
        const { view } = await render(signers.carol.address);
        await expectQuorumMatches(ethers, governance, view);
        const p = view.proposals.find((x) => x.id === 2n)!;
        states.push(p.state);
        return p;
      };
      // Alice voted with unit 1 alone, her unit 2 being in arrears (FR10):
      // a quarter of the units is met, two owners is not.
      let p = await check();
      expect(p.quorum).to.include({ unitsMet: true, votersMet: false });
      // A proposal nobody has voted on meets neither.
      await governance
        .connect(signers.firm)
        .getFunction("propose(string,uint256,uint8,address,bytes32)")(
        "Paint the hallway",
        parseUnits("100", 18),
        0,
        signers.vendor.address,
        zeroPadValue("0x04", 32),
      );
      let { view } = await render(signers.carol.address);
      await expectQuorumMatches(ethers, governance, view);
      expect(view.proposals.find((x) => x.id === 3n)!.quorum).to.include({
        unitsVoted: 0n,
        unitsMet: false,
        voters: 0,
        votersMet: false,
      });
      // Bob's vote is the second wallet.
      await governance.connect(signers.bob).castVote(2, true);
      p = await check();
      expect(p.quorum).to.include({ unitsMet: true, votersMet: true });
      await advance(ethers, await governance.VOTING_PERIOD());
      await check();
      await governance.connect(signers.stranger).queue(2);
      await check();
      await advance(ethers, await governance.TIMELOCK_DELAY());
      await governance
        .connect(signers.firm)
        .attest(2, zeroPadValue("0x05", 32));
      await governance.connect(signers.stranger).execute(2);
      await check();
      expect(states).to.deep.equal([
        "Open",
        "Open",
        "Passed",
        "Queued",
        "Executed",
      ]);
      const byId = async (id: bigint) => {
        const { view } = await render(signers.carol.address);
        await expectQuorumMatches(ethers, governance, view);
        return view.proposals.find((x) => x.id === id)!;
      };
      // Proposal 3 got no vote and its window and extension have passed: it
      // failed with quorum unmet.
      let q = await byId(3n);
      expect(q.state).to.equal("Failed");
      expect(await governance.quorumReached(3)).to.equal(false);
      // Proposal 4 is voted down by two wallets: quorum met, and Failed.
      // Proposal 5 gets no vote, so it extends.
      const propose = (name: string, hash: string) =>
        governance
          .connect(signers.firm)
          .getFunction("propose(string,uint256,uint8,address,bytes32)")(
          name,
          parseUnits("100", 18),
          0,
          signers.vendor.address,
          zeroPadValue(hash, 32),
        );
      await propose("Repaint the car park", "0x06");
      await propose("Mow the lawn", "0x07");
      for (const owner of [signers.alice, signers.bob]) {
        await governance.connect(owner).castVote(4, false);
      }
      await advance(ethers, await governance.VOTING_PERIOD());
      q = await byId(4n);
      expect(q.state).to.equal("Failed");
      expect(q.quorum).to.include({ unitsMet: true, votersMet: true });
      expect(await governance.quorumReached(4)).to.equal(true);
      q = await byId(5n);
      expect(q.state).to.equal("Extended");
      expect(q.quorum).to.include({ unitsMet: false, votersMet: false });
      expect(await governance.quorumReached(5)).to.equal(false);
      await advance(ethers, await governance.EXTENSION());
      expect((await byId(5n)).state).to.equal("Failed");
    });

    it("draws the timeline from stateAt and block times, with Extended only once voting was extended", async () => {
      const { ethers, contracts, signers, addresses, fromBlock, render } =
        await setUp();
      const { governance } = contracts;
      const [created] = await ethers.provider.getLogs({
        address: addresses.governance,
        fromBlock,
        topics: [
          governance.interface.getEvent("ProposalCreated").topicHash,
          zeroPadValue("0x02", 32),
        ],
      });
      const createdAt = await block(ethers, created.blockNumber);
      const window = await governance.VOTING_PERIOD();
      const extension = await governance.EXTENSION();

      let { html } = await render(signers.carol.address, "#/proposal/2");
      expect(timeline(html)).to.deep.equal([
        ["done", "Proposed", date(createdAt)],
        ["current", "Open", `Closes ${date(createdAt + window)}`],
        ["todo", "Passed", undefined],
        ["todo", "Queued", undefined],
        ["todo", "Firm confirms work", undefined],
        ["todo", "Executed", undefined],
      ]);
      expect(html).to.contain('<li data-step="current" aria-current="step"');
      expect(text(card(html, "h-after"))).to.equal(
        `After voting closes If it passes, Queue for payment appears here on ${date(createdAt + window)}.`,
      );
      expect(html).to.not.contain("Quorum waived");

      // One wallet voted: voting extends, and quorum is waived, in the
      // timeline and in place of the meter.
      await advance(ethers, window);
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(timeline(html).slice(0, 4)).to.deep.equal([
        ["done", "Proposed", date(createdAt)],
        ["done", "Open", `Closed ${date(createdAt + window)}`],
        ["current", "Extended", `Closes ${date(createdAt + window + extension)}`],
        ["todo", "Passed", undefined],
      ]);
      expect(html).to.contain(
        "Quorum waived. One owner&#x27;s vote can decide.</span></li>",
      );
      const votes = card(html, "h-votes");
      expect(votes).to.match(/data-slot="alert"[^>]*class="[^"]*bg-warning-soft[\s\S]*?>Quorum waived. One owner&#x27;s vote can decide.<\/div>/);
      expect(votes).to.not.contain("Units voted");
      expect(text(card(html, "h-after"))).to.contain(
        `appears here on ${date(createdAt + window + extension)}.`,
      );

      await advance(ethers, extension);
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(timeline(html).map(([s, n]) => `${s} ${n}`).slice(0, 4)).to.deep.equal([
        "done Proposed",
        "done Open",
        "done Extended",
        "current Passed",
      ]);
      // Voting is over, so no one is offered a vote.
      expect(html).to.not.contain("<form");
    });

    it("follows a Work proposal through Queue, Confirm work and Carry out, in both workspaces, offering each only from its date", async () => {
      const { ethers, contracts, signers, addresses, render } = await setUp();
      const { governance } = contracts;
      const page = async (viewer: string) =>
        (await render(viewer, "#/proposal/2", undefined)).html;
      // The firm's copy, with the firm's wallet's actions, as App gives them.
      const firm = async () => {
        const { view } = await render(signers.firm.address, "#/proposal/2");
        return renderToStaticMarkup(
          createElement(App, {
            hash: "#/proposal/2", view, firm: signers.firm.address, onAct() {}, onVote() {},
            onFirm: { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} },
          }),
        );
      };
      const owner = () => page(signers.carol.address);
      const anyone = new Contract(addresses.governance, ABI, signers.stranger);

      // Open: nothing to press but the owner's vote.
      for (const html of [await owner(), await firm()]) {
        expect(buttons(html)).to.deep.equal([]);
      }
      expect(await firm()).to.not.contain('data-proposal=');

      await governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      // Passed: anyone may queue, in either workspace.
      for (const html of [await owner(), await firm()]) {
        expect(buttons(html)).to.deep.equal(["Queue for payment"]);
        expect(text(card(html, "h-queue"))).to.match(/^Queue for payment Voting closed on \d{1,2} [A-Z][a-z]{2} \d{4}\. Queue for payment Signed in your wallet\.$/);
      }
      const queued = await anyone.queue(2n);
      const delay = await governance.TIMELOCK_DELAY();
      const eta = (await block(ethers, (await queued.wait())!.blockNumber)) + delay;

      let html = await owner();
      expect(timeline(html).slice(2)).to.deep.equal([
        ["done", "Passed", date(eta - delay)],
        ["current", "Queued", `7-day wait to ${date(eta)}`],
        ["todo", "Firm confirms work", `From ${date(eta)}`],
        ["todo", "Executed", undefined],
      ]);
      // Waiting: no button, and the firm is told the date it may confirm.
      expect(buttons(html)).to.deep.equal([]);
      expect(text(card(html, "h-carry"))).to.equal("Carry out the payment Pays Harbour Lifts Ltd up to NZD 400.00 from Operating.");
      expect(html).to.not.contain("Confirm");
      html = await firm();
      expect(buttons(html)).to.deep.equal([]);
      expect(text(card(html, "h-confirm"))).to.equal(`Confirm the work Confirm work appears here on ${date(eta)}. Rules`);
      expect(html).to.not.contain('name="evidence"');
      expect(text(card(html, "h-carry"))).to.contain("Then carry out the payment");

      await advance(ethers, delay);
      // The wait is over: the firm confirms with an evidence hash; nobody
      // may carry out yet.
      expect(buttons(await owner())).to.deep.equal([]);
      html = await firm();
      expect(buttons(html)).to.deep.equal(["Confirm work"]);
      const confirm = card(html, "h-confirm");
      expect(text(confirm)).to.equal(`Confirm the work The 7-day wait ended on ${date(eta)}. Rules Evidence hash Confirm work Signed in your wallet.`);
      expect(confirm).to.match(/<input (?=[^>]*id="evidence")(?=[^>]*name="evidence")(?=[^>]*placeholder="0x…")/);
      expect(confirm).to.match(/<button [^>]*type="submit"[^>]*>[\s\S]*?Confirm work<\/button>/);

      // Confirm work through tx.ts's ABI, as Proposal sends it.
      const asFirm = new Contract(addresses.governance, ABI, signers.firm);
      const done = await outcome(confirmWork(2n), () => asFirm.attest(2n, zeroPadValue("0x05", 32)));
      expect(done.toast).to.deep.equal({ title: "Work confirmed", body: "The work on Proposal #2 is confirmed as done." });
      for (html of [await owner(), await firm()]) {
        expect(buttons(html)).to.deep.equal(["Carry out payment"]);
        expect(html).to.not.contain('id="h-confirm"');
        expect(timeline(html).at(-1)).to.deep.equal(["current", "Executed", "Now"]);
      }
      await (await anyone.execute(2n)).wait();
      for (html of [await owner(), await firm()]) {
        expect(buttons(html)).to.deep.equal([]);
        expect(timeline(html).every(([s]) => s === "done")).to.equal(true);
      }
    });

    it("offers Carry out on a queued Admit proposal only from its eta, and a failed proposal's later steps are skipped", async () => {
      const { ethers, contracts, signers, addresses, render } = await setUp();
      const { governance } = contracts;
      const anyone = new Contract(addresses.governance, ABI, signers.stranger);
      await governance.connect(signers.firm).getFunction("propose(address,string,string)")(signers.alice.address, "Lift Co", "NZBN 1");
      await governance.connect(signers.alice).castVote(3, true);
      await governance.connect(signers.bob).castVote(3, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      const queued = await anyone.queue(3n);
      const eta = (await block(ethers, (await queued.wait())!.blockNumber)) + (await governance.TIMELOCK_DELAY());
      let { html } = await render(signers.carol.address, "#/proposal/3");
      // No firm step, and the vendor's own details.
      expect(timeline(html).map(([, n]) => n)).to.deep.equal(["Proposed", "Open", "Passed", "Queued", "Executed"]);
      expect(text(card(html, "h-facts"))).to.match(new RegExp(`^What owners are voting on Vendor Lift Co ${short(signers.alice.address)} Copy NZBN 1 Proposed \\d{1,2} [A-Z][a-z]{2} \\d{4}, by the management firm$`));
      expect(buttons(html)).to.deep.equal([]);
      expect(text(card(html, "h-carry"))).to.equal(`Admit the vendor Carry out appears here on ${date(eta)}.`);
      await advance(ethers, await governance.TIMELOCK_DELAY());
      ({ html } = await render(signers.carol.address, "#/proposal/3"));
      expect(buttons(html)).to.deep.equal(["Carry out"]);
      expect(text(card(html, "h-carry"))).to.equal("Admit the vendor Adds Lift Co to the approved vendors. Carry out Signed in your wallet.");
      await (await anyone.execute(3n)).wait();
      ({ html } = await render(signers.carol.address, "#/proposal/3"));
      expect(buttons(html)).to.deep.equal([]);

      // Proposal 4 is voted down: everything after Failed is skipped.
      await governance.connect(signers.firm).getFunction("propose(string,uint256,uint8,address,bytes32)")("Paint the hallway", parseUnits("100", 18), 0, signers.vendor.address, zeroPadValue("0x04", 32));
      await governance.connect(signers.alice).castVote(4, false);
      await governance.connect(signers.bob).castVote(4, false);
      await advance(ethers, await governance.VOTING_PERIOD());
      ({ html } = await render(signers.carol.address, "#/proposal/4"));
      expect(timeline(html).map(([s, n]) => `${s} ${n}`)).to.deep.equal([
        "done Proposed",
        "done Open",
        "current Failed",
        "skipped Queued",
        "skipped Firm confirms work",
        "skipped Executed",
      ]);
      expect(buttons(html)).to.deep.equal([]);
    });

    it("offers no action to a wallet on the wrong chain, and shows the wait on the one being signed, with every other aria-disabled", async () => {
      const { ethers, signers, contracts, render } = await setUp();
      await contracts.governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await contracts.governance.VOTING_PERIOD());
      const { view } = await render(signers.carol.address, "#/proposal/2");
      const h = (props: object) =>
        renderToStaticMarkup(createElement(App, { hash: "#/proposal/2", view, onAct() {}, ...props }));
      expect(buttons(h({}))).to.deep.equal(["Queue for payment"]);
      const wrong = { kind: "browser", account: signers.carol.address, chainId: 1n, deploymentChainId: 31337n } as const;
      expect(buttons(h({ wallet: wrong }))).to.deep.equal([]);
      expect(h({ wallet: wrong })).to.not.contain("Signed in your wallet.");
      const busy = h({ acting: { action: "queue", id: 2n } });
      expect(busy).to.contain("Waiting for your wallet…");
      expect(buttons(busy)).to.deep.equal([]);
      // Another write being signed holds this one.
      expect(h({ acting: { action: "debit", id: 0n } })).to.match(/aria-disabled="true"[^>]*>[\s\S]*?Queue for payment<\/button>/);
    });

    it("lists what owners vote on, the tally in units, both quorum conditions, and the rules", async () => {
      const { signers, render } = await setUp();
      const { view, html } = await render(signers.carol.address, "#/proposal/2");
      const p = view.proposals.find((x) => x.id === 2n)!;
      // The breadcrumb leads back to Proposals.
      expect(html).to.match(/<nav aria-label="breadcrumb"[\s\S]*?<a [^>]*href="#\/proposals"[^>]*>Proposals<\/a>[\s\S]*?aria-current="page"[^>]*>Roof repair<\/span>/);
      expect(text(html.split('data-slot="breadcrumb">')[1].split("<h1>")[0])).to.equal("Proposals Roof repair Open Work Operating");
      expect(html).to.contain("<h1>Roof repair</h1>");
      expect(text(card(html, "h-facts"))).to.equal(
        `What owners are voting on Vendor Harbour Lifts Ltd ${short(signers.vendor.address)} Copy DEMO-0001 Limit NZD 400.00 Paid from Operating Quote ${short(p.quoteHash)} Copy Proposed ${date(p.createdAt)}, by the management firm`,
      );
      expect(card(html, "h-facts")).to.contain('aria-label="Copy quote hash"');
      // Alice's unit 1 voted for it, her unit 2 being in arrears (FR10); one
      // unit is a quarter of four, one wallet is not two.
      expect(text(card(html, "h-votes"))).to.equal(
        "Votes not yet met Rules Units voted (25% of the building) 1 unit voted; 1 needed met Different owners voted 1 owner voted; 2 needed not yet met For 1 units Against 0 units",
      );
      expect(html).to.not.match(/\d+ of \d+ (units|owners)/);
      expect(votesRules(p)).to.deep.equal([
        "Passes when more units vote for than against. A tie fails.",
        "Quorum needs both: 1 of the building's 4 units, and 2 different owners.",
        "If quorum is not met when voting closes, voting extends 7 days and quorum is waived.",
        "Anyone in the building may queue a passed proposal.",
      ]);
    });

    it("VoteControl names the viewer's units that have not voted, and keeps its form while the wallet signs", async () => {
      const { signers, render } = await setUp();
      let { html } = await render(signers.bob.address, "#/proposal/2");
      const vote = card(html, "h-your-vote");
      expect(text(vote)).to.equal("Your vote Unit 3 has not voted. Rules Vote for Vote against Signed in your wallet.");
      expect(vote).to.contain('data-proposal="2"');
      for (const [value, label] of [["true", "Vote for"], ["false", "Vote against"]]) {
        expect(vote).to.match(new RegExp(`<button (?=[^>]*type="submit")(?=[^>]*name="inFavour")(?=[^>]*value="${value}")[^>]*>[\\s\\S]*?${label}</button>`));
      }
      const { view } = await render(signers.bob.address);
      html = renderToStaticMarkup(
        createElement(App, { hash: "#/proposal/2", view, voting: 2n, onVote() {} }),
      );
      expect(html).to.contain("Waiting for your wallet…");
      expect(html).to.not.contain('name="inFavour"');
      // A wrong-chain browser wallet is offered no vote.
      ({ html } = await render(signers.bob.address, "#/proposal/2", {
        kind: "browser",
        account: signers.bob.address,
        chainId: 1n,
        deploymentChainId: 31337n,
      }));
      expect(html).to.not.contain("<form");
    });

    it("explains no step: a line saying something appears here names its date", async () => {
      const { ethers, contracts, signers, render } = await setUp();
      const lines = async () => {
        const out: string[] = [];
        for (const viewer of [signers.carol.address, signers.firm.address]) {
          out.push(...(text((await render(viewer, "#/proposal/2")).html).match(/[^.]*appears here[^.]*\./g) ?? []));
        }
        return out;
      };
      const seen = [...(await lines())];
      await contracts.governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await contracts.governance.VOTING_PERIOD());
      await contracts.governance.connect(signers.stranger).queue(2);
      seen.push(...(await lines()));
      expect(seen.length).to.be.greaterThan(0);
      for (const line of seen) expect(line).to.match(/ on \d{1,2} [A-Z][a-z]{2} \d{4}\.$/);
    });

    it("says plainly that a proposal does not exist", async () => {
      const { signers, render } = await setUp();
      const { html } = await render(signers.carol.address, "#/proposal/99");
      expect(html).to.contain("<h1>Proposal #99</h1>");
      expect(html).to.contain("There is no proposal #99.");
    });
  });

  describe("Activity (#155, #181)", () => {
    // The rows as a viewer reads them, newest first.
    const eventRows = (html: string) =>
      [
        ...html.matchAll(
          /<li[^>]*><time[^>]*>([^<]*)<\/time><span>([^<]*)<\/span><span[^>]*>([^<]*)<\/span><\/li>/g,
        ),
      ].map(([, time, text, kind]) => ({
        time,
        kind,
        text: text.replace(/&#x27;/g, "'"),
      }));
    // Every page of a workspace's Activity, as markup. The App renders page
    // 1; react-dom/server renders no press, so each later page is rendered
    // from its initial page.
    const pagesOf = (html: string, workspace: "owner" | "firm", events: { time: bigint; kind: string; text: string }[]) => [
      html,
      ...Array.from({ length: Math.ceil(events.length / PER_PAGE) - 1 }, (_, i) =>
        renderToStaticMarkup(createElement(Activity, { workspace, events, initialPage: i + 2 })),
      ),
    ];
    const sentences = (rows: ReturnType<typeof eventRows>, kind: string) =>
      rows.filter((r) => r.kind === kind).map((r) => r.text);

    // The seeded building, then proposal 2 carried through to payment, so
    // every kind of event has been emitted.
    async function finished() {
      const s = await setUp();
      const { governance } = s.contracts;
      const { alice, bob, firm, stranger } = s.signers;
      await governance.connect(bob).castVote(2, true);
      await advance(s.ethers, await governance.VOTING_PERIOD());
      await governance.connect(stranger).queue(2);
      await advance(s.ethers, await governance.TIMELOCK_DELAY());
      await governance.connect(firm).attest(2, id("evidence: roof"));
      await governance.connect(stranger).execute(2);
      return { ...s, alice, bob };
    }

    it("lists every event newest first, each as its plain sentence, and names the viewer's own levy events", async () => {
      const { signers, render } = await finished();
      const { view, html: first } = await render(signers.alice.address, "#/activity");
      // Every page, in order: ten rows on each but the last.
      const pages = pagesOf(first, "owner", view.activity);
      const html = pages.join("");
      const rows = eventRows(html);
      expect(rows).to.have.length(view.activity.length);
      expect(pages.map((p) => eventRows(p).length)).to.deep.equal(
        pages.map((_, i) => Math.min(PER_PAGE, view.activity.length - i * PER_PAGE)),
      );
      // The log's order, reversed: the payment is last in the log.
      expect(rows[0].kind).to.equal("PaymentReleased");
      expect(rows.at(-1)!.kind).to.equal("RoleGranted");
      expect(rows.map((r) => r.kind).slice(0, 4)).to.deep.equal([
        "PaymentReleased",
        "WorkAttested",
        "ProposalQueued",
        "VoteCast",
      ]);
      expect(rows[0].text).to.equal(
        "NZD 400.00 paid to Harbour Lifts Ltd from Operating for Proposal #2.",
      );
      expect(rows[1].text).to.match(
        /^The firm confirmed the work on Proposal #2 is done \(evidence 0x[0-9a-f]{4}…[0-9a-f]{4}\)\.$/,
      );
      expect(rows[2].text).to.match(
        /^Proposal #2 queued\. Payment possible from \d{1,2} [A-Z][a-z]{2} \d{4}\.$/,
      );
      expect(rows[0].time).to.match(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
      expect(html).to.not.contain(short(signers.vendor.address));
      expect(sentences(rows, "VoteCast")).to.deep.equal([
        "An owner voted for Proposal #2.",
        "Unit 1 voted for Proposal #2 (1 unit).",
        "An owner voted for Proposal #1.",
        "Unit 1 voted for Proposal #1 (1 unit).",
      ]);
      expect(sentences(rows, "ProposalCreated")).to.deep.equal([
        "The firm proposed #2: Roof repair, up to NZD 400.00, from Operating, to Harbour Lifts Ltd.",
        "The firm proposed #1: admit Harbour Lifts Ltd as a vendor.",
      ]);
      expect(sentences(rows, "PayeeAdmitted")).to.deep.equal([
        "Proposal #1 executed. Harbour Lifts Ltd is now an approved vendor.",
      ]);
      expect(sentences(rows, "Deposited")).to.deep.equal([
        "NZD 250.00 deposited: NZD 200.00 to Operating, NZD 50.00 to Long-term maintenance.",
        "NZD 250.00 deposited: NZD 200.00 to Operating, NZD 50.00 to Long-term maintenance.",
      ]);
      expect(sentences(rows, "UnitBound")).to.deep.equal([
        "Unit 4 linked to an owner's wallet.",
        "Unit 3 linked to an owner's wallet.",
        "Unit 2 linked to your wallet.",
        "Unit 1 linked to your wallet.",
      ]);
      expect(sentences(rows, "RoleGranted")).to.deep.equal(
        Array(3).fill("Contract permission set at deployment."),
      );
      expect(sentences(rows, "RoleRevoked")).to.deep.equal([
        "Contract permission set at deployment.",
      ]);
      // Alice's own levy events name unit, amount, charge and date.
      expect(sentences(rows, "ChargeScheduled")).to.include(
        "Charge #4 scheduled for your Unit 1: NZD 250.00, due " +
          html.match(/Charge #4 scheduled for your Unit 1: NZD 250\.00, due ([^<]*?)\.</)![1] +
          ".",
      );
      expect(sentences(rows, "ChargeIssued")).to.include.members([
        "The firm asked for payment of Charge #1 for your Unit 2: NZD 250.00, due " +
          html.match(/Charge #1 for your Unit 2: NZD 250\.00, due ([^<]*?)\.</)![1] +
          ".",
      ]);
      expect(sentences(rows, "LevyPaid")).to.include(
        "Your Unit 1's levy of NZD 250.00 was paid.",
      );
    });

    it("pages ten events at a time under shadcn/ui's Pagination, from page 1, and has no subtitle", async () => {
      const { signers, render } = await finished();
      const { view, html } = await render(signers.alice.address, "#/activity");
      const pages = pagesOf(html, "owner", view.activity);
      expect(pages.length).to.be.greaterThan(2);
      // The links in the Pages navigation: each one's label, and whether it
      // is the current page or disabled.
      const links = (page: string) =>
        [...page.split('aria-label="Pages"')[1].split("</nav>")[0].matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map(
          ([, attrs, label]) =>
            text(label) +
            (attrs.includes('aria-current="page"') ? " current" : "") +
            (attrs.includes('aria-disabled="true"') ? " disabled" : ""),
        );
      const numbers = pages.map((_, i) => String(i + 1));
      const mark = (n: number) => numbers.map((label, i) => (i === n ? `${label} current` : label));
      expect(links(pages[0])).to.deep.equal(["Previous disabled", ...mark(0), "Next"]);
      expect(links(pages[1])).to.deep.equal(["Previous", ...mark(1), "Next"]);
      expect(links(pages.at(-1)!)).to.deep.equal(["Previous", ...mark(pages.length - 1), "Next disabled"]);
      // Each page's rows are the next ten of the list.
      expect(eventRows(pages[1]).map((r) => r.text)).to.deep.equal(view.activity.slice(10, 20).map((e) => e.text));
      // No subtitle; the rules are in the Rules popover.
      const page = text(html.split("<h1>")[1]);
      expect(page.startsWith(`Activity Rules ${date(view.activity[0].time)} `), page.slice(0, 80)).to.equal(true);
      expect(ACTIVITY_RULES.owner[1]).to.equal("Another owner's levy events name no unit and no amount.");
      expect(ACTIVITY_RULES.firm[1]).to.equal("Levy events name a charge, never a unit.");
    });

    it("NFR10: a levy event for another owner's unit names no unit, amount or charge, and with no viewer every levy event is anonymous", async () => {
      const { signers, contracts, render, ethers, addresses, fromBlock } = await finished();
      const anonymous = {
        ChargeScheduled: "A levy charge was scheduled for another owner's unit.",
        ChargeIssued: "The firm asked for payment of a levy charge for another owner's unit.",
        LevyPaid: "A levy was paid for another owner's unit.",
      };
      // The unit of each charge, and the charges the log scheduled, the firm
      // collected and were paid: five levy events of the first kind, three of
      // the second and two of the third. Charge 0 was paid before it was due,
      // so the firm never collected it.
      const unitOf = [1n, 2n, 3n, 4n, 1n];
      const events = { ChargeScheduled: [0, 1, 2, 3, 4], ChargeIssued: [1, 2, 3], LevyPaid: [0, 2] };
      for (const viewer of [
        signers.alice,
        signers.bob,
        signers.carol,
        signers.stranger,
        undefined,
      ]) {
        const { view, html: first } = await render(viewer?.address, "#/activity");
        const own = new Set(view.ownUnits.map((u) => u.unitId));
        // A vote names only the viewer's own units, and for anyone else no
        // unit and no count.
        for (const r of view.activity.filter((e) => e.kind === "VoteCast")) {
          for (const [, n] of r.text.matchAll(/Unit (\d+)/g)) {
            expect(own.has(BigInt(n)), r.text).to.equal(true);
          }
          if (r.text.startsWith("An owner")) expect(r.text).to.not.match(/\(\d/);
        }
        // A wallet with no unit, and no wallet, see no Activity (ADR-021);
        // the sentences are still checked where they are built.
        const page = own.size > 0;
        // Every page's markup, not only the first.
        const html = page ? pagesOf(first, "owner", view.activity).join("") : first;
        if (page) expect(eventRows(html)).to.have.length(view.activity.length);
        expect(eventRows(html).length > 0, String(viewer?.address)).to.equal(page);
        const levy = view.activity.filter((r) => r.kind in anonymous);
        expect(levy).to.have.length(10);
        let named = 0;
        for (const r of levy) {
          if (r.text === anonymous[r.kind as keyof typeof anonymous]) {
            // Nothing in the sentence is a unit, an amount or a charge.
            expect(r.text).to.not.match(/\d|NZD|#/);
          } else {
            named += 1;
            // Only a unit the viewer owns is ever named.
            expect(own.has(BigInt(r.text.match(/Unit (\d+)/)![1])), r.text).to.equal(true);
          }
        }
        const expected = Object.values(events)
          .flat()
          .filter((chargeId) => own.has(unitOf[chargeId])).length;
        expect(named, String(viewer?.address)).to.equal(expected);

        // The whole page, not only the sentences: nothing of another
        // owner's charge reaches the time column, an attribute or any other
        // markup. Amount is not asserted: every seeded charge is NZD 250.00,
        // which the viewer's own charges and the Deposited rows legitimately
        // show. A due date is asserted only where no own charge and no row's
        // block time shares it.
        if (!page) continue;
        const legitimate = new Set<string>(eventRows(html).map((r) => r.time));
        const dueOf = new Map<number, string>();
        for (let chargeId = 0; chargeId < unitOf.length; chargeId++) {
          dueOf.set(chargeId, date((await contracts.ledger.charges(chargeId)).dueDate));
        }
        unitOf.forEach((unit, chargeId) => {
          if (own.has(unit)) legitimate.add(dueOf.get(chargeId)!);
        });
        unitOf.forEach((unit, chargeId) => {
          if (own.has(unit)) return;
          expect(html, `Charge #${chargeId}`).to.not.contain(`Charge #${chargeId}`);
          const due = dueOf.get(chargeId)!;
          if (!legitimate.has(due)) expect(html, due).to.not.contain(due);
        });
      }

      // The firm's copy, every page: each levy event names its charge, and
      // never a unit, an amount or a due date (interface.md §4.2).
      const { view, html } = await render(signers.firm.address, "#/activity");
      const pages = pagesOf(html, "firm", view.activity);
      const rows = eventRows(pages.join(""));
      expect(rows).to.have.length(view.activity.length);
      expect(sentences(rows, "ChargeScheduled")).to.deep.equal([4, 3, 2, 1, 0].map((n) => `Charge #${n} was scheduled.`));
      expect(sentences(rows, "ChargeIssued")).to.deep.equal([3, 2, 1].map((n) => `The firm asked for payment of Charge #${n}.`));
      expect(sentences(rows, "LevyPaid")).to.deep.equal([2, 0].map((n) => `Charge #${n} was paid.`));
      // Every vote the firm sees names no unit and no count, even one cast
      // by the firm's own address when it holds units (alice, named as the
      // firm here).
      for (const t of sentences(rows, "VoteCast")) expect(t).to.match(/^An owner voted (for|against) Proposal #\d+\.$/);
      const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
      const derived = await replay(ethers.provider, addresses, fromBlock);
      const asFirm = buildView(derived, now, signers.alice.address, undefined, signers.alice.address);
      const votes = asFirm.activity.filter((e) => e.kind === "VoteCast").map((e) => e.text);
      expect(votes).to.have.length.above(0);
      for (const t of votes) expect(t).to.match(/^An owner voted (for|against) Proposal #\d+\.$/);
      const times = new Set(rows.map((r) => r.time));
      for (let chargeId = 0; chargeId < unitOf.length; chargeId++) {
        const due = date((await contracts.ledger.charges(chargeId)).dueDate);
        if (!times.has(due)) expect(pages.join(""), due).to.not.contain(due);
      }
    });

    it("names a payee not yet admitted by its shortened address, never a guessed name", async () => {
      const { signers, contracts, render } = await setUp();
      const other = signers.stranger.address;
      await contracts.governance
        .connect(signers.firm)
        .getFunction("propose(address,string,string)")(other, "Not Yet Ltd", "DEMO-0002");
      const { html } = await render(signers.alice.address, "#/activity");
      expect(sentences(eventRows(html), "ProposalCreated")[0]).to.equal(
        `The firm proposed #3: admit ${other.slice(0, 6)}…${other.slice(-4)} as a vendor.`,
      );
      expect(html).to.not.contain("Not Yet Ltd");
    });

    it("shows a plain line for an empty log", async () => {
      const { signers, render } = await setUp();
      const { view } = await render(signers.alice.address);
      const html = renderToStaticMarkup(
        createElement(App, { hash: "#/activity", view: { ...view, activity: [] } }),
      );
      expect(html).to.contain("No events yet.");
      expect(eventRows(html)).to.have.length(0);
    });
  });

  describe("Proposals (#177)", () => {
    const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    // Each tab's label and count.
    const tabs = (html: string) =>
      [...html.matchAll(/role="tab"[^>]*>([^<]*)<span[^>]*>(\d+)<\/span>/g)].map(([, label, n]) => `${label} ${n}`);
    // The cards in a tab's panel, each as its markup.
    const cards = (html: string, tab: "voting" | "waiting" | "closed") =>
      html
        .split(new RegExp(`id="[^"]*-content-${tab}"`))[1]
        .split(/<div [^>]*role="tabpanel"|<\/main>/)[0]
        .split('data-slot="card"')
        .slice(1)
        .map((card) => card.slice(card.indexOf(">") + 1));

    it("FR19: groups every proposal under Voting, Waiting to carry out and Closed, each card with its badge, kind, vendor, limit, fund and date", async () => {
      const { signers, render } = await setUp();
      const { view, html } = await render(signers.bob.address, "#/proposals");
      expect(tabs(html)).to.deep.equal(["Voting 1", "Waiting to carry out 0", "Closed 1"]);
      const [open] = cards(html, "voting");
      const closes = view.proposals.find((p) => p.id === 2n)!.closes!;
      expect(text(open)).to.equal(
        `Open Work Roof repair Vote Harbour Lifts Ltd ${short(signers.vendor.address)} DEMO-0001 Up to NZD 400.00 Operating Closes ${date(closes)} ` +
          "Units voted (25% of the building) 1 unit voted; 1 needed met Different owners voted 1 owner voted; 2 needed not yet met Unit 3 has not voted.",
      );
      expect(html).to.not.match(/\d+ of \d+ (units|owners)/);
      expect(open).to.contain('data-tone="info">Open</span>');
      expect(open).to.contain('aria-valuenow="50"');
      expect(text(cards(html, "closed")[0])).to.equal(
        `Executed Admit vendor Admit Harbour Lifts Ltd View DEMO-0001 ${short(signers.vendor.address)} Carried out ${date(view.proposals[0].steps.at(-1)!.date!)}`,
      );
      // An empty group is one Card saying what is missing (States, #187).
      expect(cards(html, "waiting").map(text)).to.deep.equal(["No proposals are waiting to be carried out."]);
      // Each card is one link, its title, stretched over the card.
      for (const card of [...cards(html, "voting"), ...cards(html, "closed")]) {
        expect(card.match(/<a /g)).to.have.length(1);
        expect(card).to.match(/<a href="#\/proposal\/\d+" class="[^"]*after:absolute after:inset-0/);
        expect(card).to.not.contain("<button");
      }
      // Alice's unit 1 has voted on proposal 2, and a unit in arrears is
      // offered no vote: her unit 2, and carol's unit 4 (FR10).
      for (const owner of [signers.alice, signers.carol]) {
        const card = cards((await render(owner.address, "#/proposals")).html, "voting")[0];
        expect(card).to.not.contain("not voted");
        expect(card).to.contain(">View</span>");
      }
    });

    it("the firm's copy links to Propose work and Vendors, and offers no vote", async () => {
      const { signers, render } = await setUp();
      const { html } = await render(signers.firm.address, "#/proposals");
      expect(html).to.match(/<a [^>]*href="#\/propose"[^>]*>[\s\S]*?<\/svg>Propose work<\/a>/);
      expect(html).to.match(/<a [^>]*href="#\/vendors"[^>]*>[\s\S]*?<\/svg>Propose a vendor<\/a>/);
      expect(tabs(html)).to.deep.equal(["Voting 1", "Waiting to carry out 0", "Closed 1"]);
      expect(cards(html, "voting")[0]).to.contain(">View</span>");
      expect(html).to.not.match(/not voted|>Vote</);
    });

    it("Waiting to carry out holds a passed and a queued Admit vendor proposal as it holds Work (#202)", async () => {
      const { ethers, contracts, signers, render } = await setUp();
      const { governance } = contracts;
      await governance.connect(signers.firm).getFunction("propose(address,string,string)")(signers.stranger.address, "Lift Co", "NZBN 1");
      await governance.connect(signers.alice).castVote(3, true);
      await governance.connect(signers.bob).castVote(3, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      let { html } = await render(signers.carol.address, "#/proposals");
      // Proposal 2 missed quorum and is extended; proposal 3 passed.
      expect(tabs(html)).to.deep.equal(["Voting 1", "Waiting to carry out 1", "Closed 1"]);
      expect(text(cards(html, "waiting")[0])).to.match(/^Passed Admit vendor Admit Lift Co View/);
      await governance.connect(signers.stranger).queue(3);
      ({ html } = await render(signers.carol.address, "#/proposals"));
      expect(text(cards(html, "waiting")[0])).to.match(/^Queued Admit vendor Admit Lift Co View/);
    });

    it("FR20, FR21: moves a proposal from Voting to Waiting to carry out to Closed, naming what happens next, and waives quorum in an Alert", async () => {
      const { ethers, contracts, signers, render } = await setUp();
      const { governance } = contracts;
      const page = async () => {
        const { view, html } = await render(signers.carol.address, "#/proposals");
        const steps = view.proposals.find((p) => p.id === 2n)!.steps;
        const at = (name: string) => date(steps.find((s) => s.name === name)!.date!);
        return { html, at };
      };
      // Only alice voted, so voting extends and quorum is waived.
      await advance(ethers, await governance.VOTING_PERIOD());
      let { html, at } = await page();
      let [card] = cards(html, "voting");
      expect(card).to.contain('data-tone="wait">Extended</span>');
      expect(card).to.match(/data-slot="alert"[^>]*class="[^"]*bg-warning-soft[^>]*>[\s\S]*?<\/svg><div data-slot="alert-title"[^>]*>Quorum waived. One owner&#x27;s vote can decide.<\/div><\/div>/);
      expect(card).to.not.contain("Units voted");

      await advance(ethers, await governance.EXTENSION());
      ({ html, at } = await page());
      expect(tabs(html)).to.deep.equal(["Voting 0", "Waiting to carry out 1", "Closed 1"]);
      expect(text(cards(html, "waiting")[0])).to.contain(`Passed Work Roof repair View`);
      expect(text(cards(html, "waiting")[0])).to.contain(`Voting closed ${at("Passed")}`);

      await governance.connect(signers.stranger).queue(2);
      ({ html, at } = await page());
      [card] = cards(html, "waiting");
      expect(card).to.contain('data-tone="wait">Queued</span>');
      expect(text(card)).to.contain(`Wait ends ${at("Queued")}`);
      await advance(ethers, await governance.TIMELOCK_DELAY());
      ({ html, at } = await page());
      expect(text(cards(html, "waiting")[0])).to.contain(`Wait ended ${at("Queued")}`);
      await governance.connect(signers.firm).attest(2, zeroPadValue("0x05", 32));
      ({ html, at } = await page());
      expect(text(cards(html, "waiting")[0])).to.contain(`Work confirmed ${at("Firm confirms work")}`);
      await governance.connect(signers.stranger).execute(2);
      ({ html, at } = await page());
      expect(tabs(html)).to.deep.equal(["Voting 0", "Waiting to carry out 0", "Closed 2"]);
      expect(text(cards(html, "closed")[1])).to.contain(`Executed Work Roof repair View`);
      expect(text(cards(html, "closed")[1])).to.contain(`Carried out ${at("Executed")}`);

      // A tie fails, and closes.
      await governance
        .connect(signers.firm)
        .getFunction("propose(string,uint256,uint8,address,bytes32)")("Paint the hallway", parseUnits("100", 18), 1, signers.vendor.address, zeroPadValue("0x04", 32));
      await governance.connect(signers.alice).castVote(3, true);
      await governance.connect(signers.bob).castVote(3, false);
      await advance(ethers, await governance.VOTING_PERIOD());
      ({ html } = await page());
      expect(tabs(html)).to.deep.equal(["Voting 0", "Waiting to carry out 0", "Closed 3"]);
      const failed = text(cards(html, "closed")[2]);
      expect(failed).to.match(/^Failed Work Paint the hallway View Harbour Lifts Ltd 0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4} DEMO-0001 Up to NZD 100\.00 Long-term maintenance Voting closed \d{1,2} [A-Z][a-z]{2} \d{4}$/);
    });
  });

  it("ADR-021: each workspace has its own five-item navigation, one current link in each bar, and a route of the other workspace opens Home and says so", async () => {
    const { signers, render } = await setUp();
    for (const [workspace, viewer] of [["owner", signers.alice.address], ["firm", signers.firm.address]] as const) {
      for (const [hash, heading, current] of ROUTES[workspace]) {
        const { html } = await render(viewer, hash);
        const at = `${workspace} ${hash}`;
        expect(html, at).to.match(/^<div data-slot="sidebar-wrapper"/);
        expect(html, at).to.contain(`<h1>${heading}</h1>`);
        // The Sidebar and the BottomBar: the same five items, one current.
        const bars = navs(html);
        expect(bars, at).to.have.length(2);
        for (const bar of bars) {
          expect(bar.map((l) => l.label), at).to.deep.equal(NAV_LABELS[workspace]);
          expect(bar.filter((l) => l.current).map((l) => l.label), at).to.deep.equal([current]);
        }
        // Only a route of the other workspace says so, in a toast (#189), and
        // never in the page; an unknown route does not.
        expect(isElsewhere(workspace, hash), at).to.equal(at === "owner #/collect" || at === "firm #/units");
        expect(html, at).to.not.contain(ELSEWHERE);
      }
    }
    const building = (await render(signers.alice.address, "#/building")).html;
    expect(text(building)).to.contain(PRIVACY_LINE);
    expect(building).to.not.contain("presentation choice");
  });

  it("ADR-021: a firm's address that holds a unit is offered no vote", async () => {
    const { signers, render } = await setUp();
    // Bob's unit has not voted on proposal 2, so as an owner he is offered
    // the vote; named as the firm in the deployment file, he is not.
    const { view, html } = await render(signers.bob.address, "#/proposal/2");
    expect(view.proposals.find((p) => p.id === 2n)!.canVote).to.equal(true);
    expect(html).to.contain('data-proposal="2"');
    const asFirm = renderToStaticMarkup(
      createElement(App, { hash: "#/proposal/2", view, firm: signers.bob.address, onVote() {} }),
    );
    expect(asFirm).to.contain("Management firm");
    expect(asFirm).to.not.contain('data-proposal=');
  });

  // interface.md §2's workspace rule, over every screen, with every action
  // App can be given, so each screen offers all its workspace has.
  it("ADR-021, interface.md §2: every screen offers an owner none of the firm's navigation or actions, the firm none of an owner's, and a no-unit address no building data", async () => {
    const { ethers, contracts, signers, render } = await setUp();
    const { governance } = contracts;
    const browser = (account?: string): Wallet => ({ kind: "browser", account, chainId: 31337n, deploymentChainId: 31337n });
    const page = async (viewer: string | undefined, hash: string, wallet?: Wallet) => {
      const { view } = await render(viewer, hash);
      return renderToStaticMarkup(
        createElement(App, {
          hash, view, wallet, firm: signers.firm.address,
          onConnect() {}, onVote() {}, onPay() {}, onDebit() {}, onAct() {},
          onFirm: { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} },
        }),
      );
    };
    // Each workspace's own navigation and actions, as its markup draws them.
    // Queue and Carry out are anyone's (NFR7), so neither is listed.
    const OWNER: [string, RegExp][] = [
      ["Your units link", /href="#\/units"/],
      ["Building link", /href="#\/building"/],
      ["Your levies", /Your levies/],
      ["Vote", /data-proposal="\d+"|Vote (?:for|against)<\/button>/],
      ["Pay", /Pay (?:now|early)<\/button>/],
      ["Set up direct debit", /Set up direct debit<\/button>/],
    ];
    const FIRM: [string, RegExp][] = [
      ["Management firm", /Management firm/],
      ["Collect levies link", /href="#\/collect"/],
      ["Vendors link", /href="#\/vendors"/],
      ["Propose work link", /href="#\/propose"/],
      ["Propose", /Propose<\/button>/],
      ["Propose vendor", /Propose vendor<\/button>/],
      ["Confirm work", /Confirm work<\/button>/],
      ["Collect", /Collect \d+ charges?<\/button>/],
    ];
    const hashes = [...new Set([...ROUTES.owner, ...ROUTES.firm].map(([h]) => h)), "#/proposal/1"];
    // Everything the building's log gives an owner: none of it may reach a
    // wallet with no unit, or no wallet.
    const owner = (await render(signers.carol.address, "#/")).view;
    const data = [
      ...owner.proposals.map((p) => p.description),
      ...owner.vendors.flatMap((v) => [v.name, v.companyId, v.payee, short(v.payee)]),
      ...owner.activity.map((e) => e.text),
    ];
    expect(data).to.not.be.empty;
    const seen = { owner: new Set<string>(), firm: new Set<string>() };

    // Two stages: as seeded (proposal 2 open, charges due), then with
    // proposal 2 queued and its 7-day wait over, so Confirm work is offered.
    for (const stage of ["seeded", "wait over"]) {
      if (stage === "wait over") {
        await governance.connect(signers.bob).castVote(2, true);
        await advance(ethers, await governance.VOTING_PERIOD());
        await governance.connect(signers.stranger).queue(2);
        await advance(ethers, await governance.TIMELOCK_DELAY());
      }
      for (const hash of hashes) {
        for (const viewer of [signers.alice, signers.bob, signers.carol]) {
          const html = await page(viewer.address, hash);
          for (const [name, mark] of FIRM) expect(html, `${stage}, owner ${hash}: ${name}`).to.not.match(mark);
          for (const [name, mark] of OWNER) if (mark.test(html)) seen.owner.add(name);
        }
        const html = await page(signers.firm.address, hash);
        for (const [name, mark] of OWNER) expect(html, `${stage}, firm ${hash}: ${name}`).to.not.match(mark);
        for (const [name, mark] of FIRM) if (mark.test(html)) seen.firm.add(name);
        for (const [who, html] of [
          ["no unit", await page(signers.stranger.address, hash)],
          ["no unit, browser", await page(signers.stranger.address, hash, browser(signers.stranger.address))],
          ["no wallet", await page(undefined, hash, browser())],
        ]) {
          const at = `${stage}, ${who} ${hash}`;
          expect(html, at).to.not.contain('aria-label="Workspace"');
          for (const [name, mark] of [...OWNER, ...FIRM]) expect(html, `${at}: ${name}`).to.not.match(mark);
          for (const d of data) expect(html, `${at}: ${d}`).to.not.contain(d);
          expect(html, at).to.not.match(/NZD|Unit \d|Proposal #|Charge #|Operating|Long-term maintenance/);
        }
      }
    }
    // Each workspace was offered every one of its own, so the absences above
    // are not vacuous.
    expect([...seen.owner].sort()).to.deep.equal(OWNER.map(([n]) => n).sort());
    expect([...seen.firm].sort()).to.deep.equal(FIRM.map(([n]) => n).sort());
  });

  it("#186: Connect and No unit show one Card with exactly its own words and no navigation, on every route", async () => {
    const { signers, render } = await setUp();
    const { stranger } = signers;
    const browser = (account?: string): Wallet => ({ kind: "browser", account, chainId: 31337n, deploymentChainId: 31337n });
    const CONNECT = "Kaitiaki Connect your wallet Connect wallet Your wallet signs every action. Kaitiaki never asks for a key, seed phrase or password.";
    const NO_UNIT = `Kaitiaki This wallet holds no unit in this building If you own a unit here, switch to the wallet bound to it. Connected ${stranger.address}`;
    for (const hash of [...ROUTES.owner, ...ROUTES.firm].map(([h]) => h)) {
      for (const [html, words] of [
        [(await render(undefined, hash, browser())).html, CONNECT],
        [(await render(stranger.address, hash, browser(stranger.address))).html, NO_UNIT],
        [(await render(stranger.address, hash)).html, NO_UNIT],
      ]) {
        // The page's words are exactly the Card's, in one Card, with no
        // navigation.
        expect(text(html), hash).to.equal(words);
        expect(html.match(/data-slot="card"/g), hash).to.have.length(1);
        expect(html, hash).to.not.contain("<nav");
      }
    }
  });

  it("FR41: holds no key, and its ABI has no view or pure function", async () => {
    const functions = ABI.fragments.filter(
      (f): f is FunctionFragment => f.type === "function",
    );
    expect(functions.map((f) => f.name)).to.include.members([
      "castVote",
      "approve",
      "payLevy",
      "collect",
      "queue",
      "execute",
      "propose",
      "attest",
    ]);
    for (const f of functions) {
      expect(["view", "pure"], f.format()).to.not.include(f.stateMutability);
    }

    const dir = new URL("../interface/src/", import.meta.url);
    // Every source file, at any depth: a file that moves or changes
    // extension is still checked.
    const files = (await readdir(dir, { recursive: true })).filter((f) =>
      /\.tsx?$/.test(f),
    );
    expect(files).to.include("tx.ts");
    for (const file of files) {
      const source = await readFile(new URL(file, dir), "utf8");
      expect(source, file).to.not.match(/0x[0-9a-fA-F]{64}/);
      expect(source, file).to.not.match(/\bnew Wallet\b|privateKey|mnemonic/i);
      // tx.ts's ABI is the only one: no other file may name a function.
      if (file !== "tx.ts") expect(source, file).to.not.match(/"function /);
    }
  });

  it("shows a refusal as a destructive Alert with its error name, and no Toast or Dialog markup of its own (#189)", () => {
    const html = (props: object) =>
      renderToStaticMarkup(createElement(App, { hash: "#/", ...props }));
    const refused = html({
      notice: {
        variant: "destructive",
        title: "Your vote was not recorded",
        description:
          "This wallet holds no unit in this building, so it cannot vote.",
        code: "NotBoundOwner",
      },
    });
    expect(refused).to.match(/<div data-slot="alert" role="alert" class="[^"]*bg-destructive-soft text-destructive[^"]*"><svg[^>]*lucide-circle-alert[^>]*>/);
    expect(refused).to.contain(
      '>Your vote was not recorded</div><div data-slot="alert-description" class="col-start-2 grid justify-items-start gap-1 text-base text-muted-foreground [&amp;_p]:leading-relaxed">This wallet holds no unit in this building, so it cannot vote.<p class="font-mono text-sm">NotBoundOwner</p></div></div>',
    );
    // The old states.tsx markup is gone; the Dialog is shadcn/ui's, in a
    // portal react-dom/server does not render, and toasts are Sonner's.
    for (const props of [{}, { signing: "a vote for Proposal #2 with Units 1 and 2" }]) {
      expect(html(props)).to.not.match(/<dialog|class="dialog|class="toast|class="alert"/);
    }
  });

  it("names a wallet on another chain and offers it nothing; asks an unconnected wallet to connect; tells a wallet with no unit", async () => {
    const { signers, render } = await setUp();
    const { bob, stranger } = signers;
    const browser = (account: string | undefined, chainId: bigint): Wallet => ({
      kind: "browser",
      account,
      chainId,
      deploymentChainId: 31337n,
    });

    // On chain 1, against a deployment on 31337: both ids named, and no
    // action — not bob's vote, which he could cast on the right chain,
    // and not Connect wallet.
    for (const account of [undefined, bob.address]) {
      const { html } = await render(
        account,
        "#/proposal/2",
        browser(account, 1n),
      );
      expect(html, account).to.match(
        /<div data-slot="alert" role="alert" class="[^"]*bg-warning-soft text-warning[^"]*"><svg[^>]*lucide-triangle-alert[^>]*>.*?<div data-slot="alert-title"[^>]*>Your wallet is on chain 1\.<\/div><div data-slot="alert-description"[^>]*>Switch it to chain 31337 to act\.<\/div>/,
      );
      expect(html, account).to.not.contain("<form");
      expect(html, account).to.not.contain("Connect wallet");
    }
    // The control: on the right chain, bob is offered his vote.
    expect(
      (
        await render(
          bob.address,
          "#/proposal/2",
          browser(bob.address, 31337n),
        )
      ).html,
    ).to.match(/<form [^>]*data-proposal="2">/);

    // On the right chain, not yet connected.
    for (const hash of ["#/", "#/units"]) {
      const { html } = await render(
        undefined,
        hash,
        browser(undefined, 31337n),
      );
      expect(html, hash).to.match(/<h1 class="[^"]*">Connect your wallet<\/h1>/);
      expect(html.match(/<button[^>]*>.*?Connect wallet<\/button>/g), hash).to.have.length(1);
    }

    // Connected, holding no unit.
    for (const hash of ["#/", "#/units"]) {
      const { html } = await render(
        stranger.address,
        hash,
        browser(stranger.address, 31337n),
      );
      expect(html, hash).to.match(/<h1 class="[^"]*">This wallet holds no unit in this building<\/h1>/);
      expect(html, hash).to.contain(stranger.address);
      expect(html, hash).to.not.contain("<form");
      expect(html, hash).to.not.contain("Connect your wallet");
    }
  });

  it("shows the loading state until the log is read, and only the notice if reading fails", () => {
    const html = (props: object) =>
      renderToStaticMarkup(createElement(App, { hash: "#/", ...props }));
    // The States mock-up's Loading: one Card, its line, three Skeletons.
    const loading = html({});
    expect(loading).to.match(/^<main [^>]*><div data-slot="card"[^>]*aria-busy="true"/);
    expect(text(loading)).to.equal("Reading the building&#x27;s record");
    expect(loading.match(/data-slot="skeleton"/g)).to.have.length(3);
    expect(loading).to.not.match(/class="(?:card|skeleton|spinner|row)[ "]/);

    const failed = html({
      failed: true,
      notice: {
        variant: "destructive",
        title: "The event log could not be read.",
        description: "connection refused",
      },
    });
    expect(failed).to.not.contain("Reading the building");
    expect(failed).to.not.contain('data-slot="skeleton"');
    expect(failed).to.match(
      /^<main [^>]*><div data-slot="alert" role="alert" class="[^"]*bg-destructive-soft[^"]*"><svg[^>]*>.*?<\/svg><div data-slot="alert-title"[^>]*>The event log could not be read\.<\/div><div data-slot="alert-description"[^>]*>connection refused<\/div><\/div><\/main>$/,
    );
  });

  it("formats money exactly, truncated to the cent, and dates in New Zealand time", () => {
    const UNIT = 10n ** 18n;
    expect(nzd(0n)).to.equal("NZD 0.00");
    expect(nzd(250n * UNIT)).to.equal("NZD 250.00");
    expect(nzd(48_000n * UNIT)).to.equal("NZD 48,000.00");
    // 22 significant digits and a sub-cent remainder: a Number keeps about
    // 15, and rounding would add a cent that does not exist.
    expect(nzd(1_234_567_890_123_456_789n * UNIT + 129n * 10n ** 14n)).to.equal(
      "NZD 1,234,567,890,123,456,789.01",
    );
    expect(nzd(999n * 10n ** 13n)).to.equal("NZD 0.00");
    expect(nzd(String(19_999n * 10n ** 15n))).to.equal("NZD 19.99");
    // 13 Oct 2026, 11:30 UTC is 14 Oct 2026, 00:30 in New Zealand.
    // Three-letter months, September too, whatever the locale's own.
    expect(date(BigInt(Date.UTC(2027, 8, 8) / 1000))).to.equal("8 Sep 2027");
    expect(date(BigInt(Date.UTC(2026, 9, 13, 11, 30) / 1000))).to.equal(
      "14 Oct 2026",
    );
  });
});

describe("Transactions (#150)", () => {
  const UNIT = 10n ** 18n;
  const who = "0x0000000000000000000000000000000000000001";
  // 13 Oct 2026, 11:30 UTC: 14 Oct 2026 in New Zealand.
  const when = BigInt(Date.UTC(2026, 9, 13, 11, 30) / 1000);
  // Each error the design names, arguments to encode, and its message
  // (RefusalNotice's table and interface.md §3's additions).
  const MESSAGES: [string, unknown[], string][] = [
    ["NotBoundOwner", [who], "This wallet holds no unit in this building, so it cannot vote."],
    ["AlreadyVoted", [2, who], "Your units have already voted on this proposal."],
    ["InArrears", [2, who], "A unit with an overdue levy cannot vote until the levy is paid."],
    ["VotingClosed", [2], "Voting on this proposal has closed."],
    ["NotReady", [2, when], "The 7-day wait ends on 14 Oct 2026."],
    ["NotAttested", [2], "Payment waits for the firm to confirm the work is done."],
    ["PayeeNotRegistered", [who], "This vendor has not been approved by owners."],
    ["ChargeNotDue", [1, when], "This charge cannot be collected before 14 Oct 2026."],
    ["NotFirm", [who], "Only the management firm’s wallet can do this."],
    ["AlreadyAttested", [2], "The firm has already confirmed this work."],
    ["EvidenceHashIsZero", [], "Add the evidence hash before confirming."],
    ["NotPassed", [2, 0], "Only a proposal that passed can be queued."],
    ["AlreadyQueued", [2], "This proposal is already queued."],
    ["NotQueued", [2, 0], "This proposal is not queued for payment."],
    ["AlreadyExecuted", [2], "This proposal has already been carried out."],
    ["UnknownProposal", [9], "There is no proposal with that number."],
    ["ChargeAlreadyPaid", [1], "This charge has already been paid."],
    // amount, alreadyReleased and limit differ, so the wrong one shows.
    ["AmountExceedsLimit", [2, 600n * UNIT, 100n * UNIT, 500n * UNIT], "This payment would go over the proposal’s cap of NZD 500.00."],
    ["VendorNameIsEmpty", [], "Add the vendor's name before proposing."],
    ["CompanyIdIsEmpty", [], "Add the vendor's company identifier before proposing."],
    ["NotWorkProposal", [2], "Only a work proposal needs the firm to confirm the work."],
    ["ERC20InsufficientBalance", [who, 0, 1], "This wallet does not hold enough NZD to pay this charge."],
    ["ERC20InsufficientAllowance", [who, 0, 1], "The levy ledger was not approved to take this payment. Approve it in your wallet, then pay."],
  ];

  it("knows every custom error of the six contracts and MockNZD", async () => {
    for (const name of [
      "Treasury",
      "Governance",
      "MembershipRegistry",
      "LevyLedger",
      "PayeeRegistry",
      "TimelockController",
      "MockNZD",
    ]) {
      const { abi } = await hre.artifacts.readArtifact(name);
      new Interface(abi).forEachError((e) =>
        expect(ABI.getError(e.format()), `${name}.${e.name}`).to.not.equal(
          null,
        ),
      );
    }
  });

  it("decodes each named error to its RefusalNotice message", () => {
    for (const [name, args, message] of MESSAGES) {
      expect(refusal({ data: ABI.encodeErrorResult(name, args) })).to.deep.equal({
        name,
        message,
      });
    }
  });

  it("names an error it has no message for, and never guesses a reason", () => {
    expect(
      refusal({ data: ABI.encodeErrorResult("FailedCall", []) }),
    ).to.deep.equal({
      name: "FailedCall",
      message: "The contract refused this action (FailedCall).",
    });
  });

  it("never throws on revert data it cannot decode", () => {
    // ethers gives an empty revert, `revert()` or a bare `require`, as "0x".
    for (const data of ["0x", "0x1234", ABI.getError("NotReady")!.selector]) {
      expect(refusal({ data, shortMessage: "execution reverted" }), data).to.deep.equal({
        message: "execution reverted",
      });
    }
    expect(refusal(undefined)).to.deep.equal({ message: "undefined" });
  });

  it("tells the truth when a payment is refused after its approval was mined", () => {
    const reject = makeError("user rejected action", "ACTION_REJECTED", {
      action: "sendTransaction",
      reason: "rejected",
    });
    expect(approvedRefusal(reject)).to.deep.equal({
      message:
        "You cancelled the payment in your wallet. The approval was already sent, so the levy ledger stays approved for that amount. Press Pay to try again.",
    });
    expect(
      approvedRefusal({ data: ABI.encodeErrorResult("ChargeAlreadyPaid", [1]) }),
    ).to.deep.equal({
      name: "ChargeAlreadyPaid",
      message:
        "This charge has already been paid. The approval was already sent, so the levy ledger stays approved for that amount.",
    });
    // Its own message says the approval fell short, so nothing is appended.
    const short = {
      data: ABI.encodeErrorResult("ERC20InsufficientAllowance", [who, 0, 1]),
    };
    expect(approvedRefusal(short)).to.deep.equal(refusal(short));
    // Every other action keeps the generic sentence.
    expect(refusal(reject).message).to.contain("Nothing was sent.");
  });

  it("has its own sentence for a wallet rejection", () => {
    expect(
      refusal(
        makeError("user rejected action", "ACTION_REJECTED", {
          action: "sendTransaction",
          reason: "rejected",
        }),
      ),
    ).to.deep.equal({
      message: "You cancelled the request in your wallet. Nothing was sent.",
      cancelled: true,
    });
  });

  describe("send", () => {
    const VOTE = {
      signing: "a vote for Proposal #2 with Unit 4",
      done: { title: "Vote recorded", body: "Unit 4 voted for Proposal #2." },
      refused: "Your vote was not recorded",
    };
    // The page's state as send leaves it, and a copy of it at each moment the
    // fake transaction is asked to sign and to wait.
    function page(prompt: boolean) {
      const state: Record<string, unknown> = {
        signing: undefined,
        // Sonner's toasts, newest last; they close themselves.
        toasts: [],
        // What the previous transaction left behind.
        notice: { variant: "destructive", title: "earlier", description: "" },
        reloads: 0,
      };
      const seen: Record<string, Record<string, unknown>> = {};
      const ui = {
        prompt,
        setSigning: (v?: string) => (state.signing = v),
        toast: (v: object) => (state.toasts = [...(state.toasts as object[]), v]),
        setNotice: (v?: object) => (state.notice = v),
        reload: async () => void (state.reloads = (state.reloads as number) + 1),
      };
      const sign = (wait: () => Promise<unknown>) => async () => {
        seen.signing = { ...state };
        return {
          wait: () => {
            seen.waiting = { ...state };
            return wait();
          },
        };
      };
      return { state, seen, ui, sign };
    }

    it("shows the Dialog only while the wallet signs, then a toast, then reads the log again", async () => {
      const { state, seen, ui, sign } = page(true);
      await send(VOTE, sign(async () => {}), ui);
      // The last transaction's Alert goes as the Dialog opens.
      expect(seen.signing).to.deep.include({
        signing: VOTE.signing,
        toasts: [],
        notice: undefined,
      });
      // Signed: the chain, not the wallet, is what is left, and the log is
      // read only once the block has it.
      expect(seen.waiting).to.deep.include({ signing: undefined, toasts: [], reloads: 0 });
      expect(state).to.deep.equal({
        signing: undefined,
        toasts: [VOTE.done],
        notice: undefined,
        reloads: 1,
      });
    });

    it("shows a request cancelled in the wallet as a toast, not an Alert, unless a payment's approval was already mined", async () => {
      const reject = makeError("user rejected action", "ACTION_REJECTED", {
        action: "sendTransaction",
        reason: "rejected",
      });
      const { state, ui } = page(true);
      await send(VOTE, () => Promise.reject(reject), ui);
      expect(state).to.deep.equal({
        signing: undefined,
        toasts: [{ title: "You cancelled the request in your wallet. Nothing was sent.", cancelled: true }],
        notice: undefined,
        reloads: 1,
      });
      // The charge is still to pay, so that stays until the viewer acts.
      const paid = page(true);
      await send({ ...VOTE, refuse: approvedRefusal }, () => Promise.reject(reject), paid.ui);
      expect(paid.state.toasts).to.deep.equal([]);
      expect(paid.state.notice).to.deep.include({ variant: "destructive", code: undefined });
    });

    it("resolves true only when the transaction was mined, which is when a form is emptied", async () => {
      const ui = { prompt: false, setSigning() {}, toast() {}, setNotice() {}, async reload() {} };
      const action = { signing: "x", done: { title: "t", body: "b" }, refused: "r" };
      expect(await send(action, async () => ({ wait: async () => {} }), ui)).to.equal(true);
      expect(await send(action, async () => { throw new Error("no"); }, ui)).to.equal(false);
    });

    it("closes the Dialog and shows a RefusalNotice when the contract refuses", async () => {
      const { state, ui } = page(true);
      const data = ABI.encodeErrorResult("NotBoundOwner", [who]);
      await send(VOTE, () => Promise.reject({ data }), ui);
      expect(state).to.deep.equal({
        signing: undefined,
        toasts: [],
        notice: {
          variant: "destructive",
          title: "Your vote was not recorded",
          description:
            "This wallet holds no unit in this building, so it cannot vote.",
          code: "NotBoundOwner",
        },
        reloads: 1,
      });
    });

    it("opens no Dialog when the local node signs, because no wallet asks anything", async () => {
      const { state, seen, ui, sign } = page(false);
      await send(VOTE, sign(async () => {}), ui);
      expect(seen.signing).to.include({ signing: undefined });
      expect(state).to.deep.include({ toasts: [VOTE.done], reloads: 1 });
    });
  });

  describe("real refusals on the seeded building (#156)", () => {
    it("NotReady: carrying out, or the firm confirming, before the wait ends names the date", async () => {
      const { ethers } = await network.getOrCreate();
      const { addresses, signers, contracts } = await deployBuilding(ethers);
      const { governance } = contracts;
      await governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      const queued = await governance.connect(signers.stranger).queue(2);
      const eta =
        BigInt((await ethers.provider.getBlock((await queued.wait())!.blockNumber))!.timestamp) +
        (await governance.TIMELOCK_DELAY());
      const message = `The 7-day wait ends on ${date(eta)}.`;
      const asStranger = new Contract(addresses.governance, ABI, signers.stranger);
      // attest is the firm's, which this interface never sends.
      const asFirm = new Contract(
        addresses.governance,
        ["function attest(uint256 proposalId, bytes32 evidenceHash)"],
        signers.firm,
      );
      for (const call of [
        () => asStranger.execute(2n),
        () => asFirm.attest(2n, id("evidence: roof")),
      ]) {
        const error = await call().catch((e: unknown) => e);
        expect(refusal(error)).to.deep.equal({ name: "NotReady", message });
      }
      expect((await outcome(carryOut(2n), () => asStranger.execute(2n))).notice).to.deep.equal({
        variant: "destructive",
        title: "This proposal cannot be carried out yet",
        description: message,
        code: "NotReady",
      });
    });

    it("ChargeNotDue: the firm collecting a charge before its due date names the date", async () => {
      const { ethers } = await network.getOrCreate();
      const { addresses, signers, fromBlock } = await deployBuilding(ethers);
      const ledger = new Contract(addresses.levyLedger, ABI, signers.firm);
      const derived = await replay(ethers.provider, addresses, fromBlock);
      const dueDate = derived.charges.get(4n)!.dueDate;
      expect((await outcome(collectLevies(1), () => ledger.collect([4n]))).notice).to.deep.equal({
        variant: "destructive",
        title: "The levies were not collected",
        description: `This charge cannot be collected before ${date(dueDate)}.`,
        code: "ChargeNotDue",
      });
    });

    it("NotFirm: an owner collecting a due levy is refused in plain words", async () => {
      const { ethers } = await network.getOrCreate();
      const { addresses, signers } = await deployBuilding(ethers);
      const ledger = new Contract(addresses.levyLedger, ABI, signers.alice);
      expect((await outcome(collectLevies(1), () => ledger.collect([1n]))).notice).to.deep.equal({
        variant: "destructive",
        title: "The levies were not collected",
        description: "Only the management firm’s wallet can do this.",
        code: "NotFirm",
      });
    });
  });

  it("decodes a real refusal: a wallet with no unit votes", async () => {
    const { ethers } = await network.getOrCreate();
    const { addresses, signers } = await deployBuilding(ethers);
    const governance = new Contract(
      addresses.governance,
      ABI,
      signers.stranger,
    );
    const error = await governance.castVote(2, true).catch((e: unknown) => e);
    expect(refusal(error)).to.deep.equal({
      name: "NotBoundOwner",
      message:
        "This wallet holds no unit in this building, so it cannot vote.",
    });
  });
});
