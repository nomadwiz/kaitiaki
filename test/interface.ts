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

import { App, type Wallet } from "../interface/src/app.js";
import { checkEvidence, checkVendor, checkWork } from "../interface/src/screens/firm.js";
import { date, nzd, short } from "../interface/src/format.js";
import { ABI, approvedRefusal, carryOut, collectLevies, confirmWork, payment, proposeVendor, proposeWork, refusal, send, standingApproval } from "../interface/src/tx.js";
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
    setToast: (t) => void (shown.toast = t),
    setNotice: (n) => void (shown.notice = n),
    async reload() {},
  });
  return shown;
}

const ZERO = "0x" + "11".repeat(20);
const STATES = ["Open", "Extended", "Passed", "Failed", "Queued", "Executed"];

// Each route, the heading its screen opens with, and the link marked current.
const ROUTES = [
  ["#/", "Home", "Home"],
  ["#/proposal/2", "Roof repair", "Home"],
  ["#/units", "Your units and levies", "Your units"],
  ["#/register", "Building register", "Register"],
  ["#/activity", "Activity", "Activity"],
  ["#/actions", "Anyone’s actions", "Actions"],
  ["#/firm", "Firm workspace", "Firm"],
  ["#/no-such-screen", "Home", "Home"],
];

const PRIVACY_LINE =
  '<p class="privacy-line">The full record is public on the chain. This page chooses to show only whether each unit is current or in arrears. That is a presentation choice, not protection.</p>';

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
      const view = buildView(derived, now, viewer);
      return {
        view,
        html: renderToStaticMarkup(
          createElement(App, { hash, view, wallet, onPay: () => {}, onAct: () => {} }),
        ),
      };
    };
    return { ethers, ...building, render };
  }

  it("NFR10: for a unit other than the viewer's own, renders exactly one of {current, in arrears} and no digit", async () => {
    const { signers, render } = await setUp();
    const { alice, bob, carol, stranger } = signers;

    for (const viewer of [alice, bob, carol, stranger]) {
      const { view, html } = await render(viewer.address, "#/register");
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

    // The case that matters: as alice, carol's unit 4 is in arrears, and the
    // page says so with no amount and no date.
    const { html } = await render(alice.address, "#/register");
    expect(otherUnitRows(html)).to.deep.equal([
      { text: "Unit 3 current", statuses: ["current"] },
      { text: "Unit 4 in arrears", statuses: ["in arrears"] },
    ]);
  });

  it("FR13: Register lists the approved vendor by name, shortened address and company identifier, and a Work card names it", async () => {
    const { signers, render } = await setUp();
    const vendor = signers.vendor.address;
    const short = `${vendor.slice(0, 6)}…${vendor.slice(-4)}`;
    const { view, html } = await render(signers.alice.address, "#/register");
    expect(view.vendors.map((v) => [v.payee, v.name, v.companyId])).to.deep.equal([
      [vendor, "Harbour Lifts Ltd", "DEMO-0001"],
    ]);
    const row = html.match(/<tr><td><b>Harbour Lifts Ltd<\/b><\/td>([\s\S]*?)<\/tr>/)![1];
    expect(row).to.contain(short);
    expect(row).to.contain("DEMO-0001");
    // Vendor rows are not unit rows, so NFR10's check never reads them.
    expect(otherUnitRows(html).join()).to.not.contain("Harbour");

    // Proposal 2 pays the vendor: its card says who, by name, then wallet.
    const home = (await render(signers.alice.address, "#/")).html;
    expect(home).to.match(
      new RegExp(`<dt>Vendor</dt><dd>Harbour Lifts Ltd <span class="addr">${short}`),
    );
  });

  it("shows the viewer's own arrears, and stops surfacing a resolved arrear (R4)", async () => {
    const { signers, contracts, render } = await setUp();
    const { alice, bob, carol } = signers;
    // An overdue charge on Your units: its amount, then its number and due
    // date.
    const overdue =
      /<p class="charge-amount">NZD 250\.00<\/p><p class="field-hint"[^>]*>Charge #1 · was due \d{1,2} [A-Z][a-z]{2} \d{4} · not covered when the firm collected<\/p>/;

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
    expect(html).to.not.contain("was due");
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
          issued: false,
          overdue: false,
        },
      ]);
      expect(unit(view, 2n).charges.map((c) => [c.chargeId, c.issued, c.overdue])).to.deep.equal([
        [1n, true, true],
      ]);
      expect(unit(view, 1n).status).to.equal("current");
      expect(html).to.match(/Charge #4 · due \d{1,2} [A-Z][a-z]{2,3} \d{4} · not yet collected/);
      expect(html).to.match(/Charge #1 · was due \d{1,2} [A-Z][a-z]{2,3} \d{4} · not covered when the firm collected/);
      expect(html).to.contain('<button class="btn" type="button">Pay NZD 250.00</button>');
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
      expect(html).to.not.contain("Pay NZD");
      expect(html).to.not.contain("Charge #");
    });

    it("offers Pay on Your units and not on Home, which shares the unit card", async () => {
      const { signers, render } = await setUp();
      const units = await render(signers.alice.address, "#/units");
      const home = await render(signers.alice.address, "#/");
      expect(units.html.match(/Pay NZD 250\.00/g)).to.have.length(2);
      expect(home.html).to.not.contain("Pay NZD");
      // Home lists overdue charges only: unit 2's, not unit 1's scheduled #4.
      expect(home.html).to.not.contain("Charge #4");
      expect(home.html).to.contain("Charge #1 · was due");
      expect(home.html).to.contain('<p class="muted-text">No overdue charges.</p>');
      expect(units.html).to.contain("Charge #4 · due");
    });

    it("disables every other Pay while one payment is in progress", async () => {
      const { signers, render } = await setUp();
      const { view } = await render(signers.alice.address, "#/units");
      const html = renderToStaticMarkup(
        createElement(App, {
          hash: "#/units",
          view,
          onPay: () => {},
          paying: 1n,
        }),
      );
      // Charge 1 shows the wait; charge 4's Pay stays but cannot be pressed.
      expect(html).to.contain("Waiting for your wallet…");
      expect(html).to.contain(
        '<button class="btn" type="button" aria-disabled="true">Pay NZD 250.00</button>',
      );
      expect(html).to.not.contain('<button class="btn" type="button">Pay');
    });

    it("says two signatures are needed in the signing Dialog", () => {
      const { signing } = payment(14n, 57n, 1240n * 10n ** 18n);
      const html = renderToStaticMarkup(createElement(App, { hash: "#/", signing }));
      expect(html).to.contain("Two signatures are needed");
      expect(html).to.contain("Charge #57");
      expect(html).to.contain("NZD 1,240.00");
    });
  });

  describe("Anyone's actions (#156)", () => {
    const QUEUE = '<button class="btn" data-size="sm" type="button">Queue</button>';
    const CARRY = '<button class="btn" data-size="sm" type="button">Carry out</button>';
    // A card's content, by its title.
    const section = (html: string, title: string) =>
      html
        .split(`<h2 class="card-title">${title}</h2>`)[1]
        .split("</section>")[0]
        .split('<div class="card-content')[1];
    const text = (html: string) =>
      html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    // A new vendor for the firm to propose, carried through the vote.
    async function admitPassed(s: Awaited<ReturnType<typeof setUp>>) {
      const { governance } = s.contracts;
      const { firm, bob, alice } = s.signers;
      await governance
        .connect(firm)
        .getFunction("propose(address,string,string)")(alice.address, "Lift Co", "NZBN 1");
      await governance.connect(alice).castVote(3, true);
      await governance.connect(bob).castVote(3, true);
      await advance(s.ethers, await governance.VOTING_PERIOD());
    }

    it("ADR-020: lists no levy charge, because collecting is the firm's", async () => {
      const { signers, render } = await setUp();
      const { html } = await render(signers.alice.address, "#/actions");
      expect(html).to.not.match(/Charge #|Issue|Collect/);
    });

    it("says an open proposal can be queued if it passes, with the day voting closes", async () => {
      const { signers, render } = await setUp();
      const { view, html } = await render(signers.alice.address, "#/actions");
      const closes = view.proposals.find((p) => p.id === 2n)!.closes!;
      expect(text(section(html, "Queue passed proposals"))).to.contain(
        `No proposal is waiting to be queued. Proposal #2 can be queued if it passes when voting closes on ${date(closes)}.`,
      );
      expect(html).to.not.contain(QUEUE);
      expect(html).to.not.contain(CARRY);
      expect(section(html, "Carry out ready proposals")).to.contain("No proposal is waiting to be carried out.");
    });

    it("offers Queue to a Passed proposal, and queue succeeds", async () => {
      const { ethers, signers, contracts, addresses, render } = await setUp();
      const { governance } = contracts;
      await governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      const { html } = await render(signers.stranger.address, "#/actions");
      const card = section(html, "Queue passed proposals");
      expect(card).to.contain("#2");
      expect(card).to.contain("Roof repair");
      expect(card).to.contain(QUEUE);
      expect(html).to.not.contain(CARRY);
      await (await new Contract(addresses.governance, ABI, signers.stranger).queue(2n)).wait();
      const after = await render(signers.stranger.address, "#/actions");
      expect(section(after.html, "Queue passed proposals")).to.not.contain(QUEUE);
      expect(section(after.html, "Carry out ready proposals")).to.contain("Roof repair");
    });

    it("offers Carry out to a queued Admit proposal only once its wait has ended", async () => {
      const s = await setUp();
      const { ethers, signers, addresses, render } = s;
      await admitPassed(s);
      const governance = new Contract(addresses.governance, ABI, signers.stranger);
      const queued = await governance.queue(3n);
      const eta = BigInt((await ethers.provider.getBlock((await queued.wait())!.blockNumber))!.timestamp) + (await s.contracts.governance.TIMELOCK_DELAY());
      let { html } = await render(signers.stranger.address, "#/actions");
      let card = section(html, "Carry out ready proposals");
      expect(card).to.contain("Admit Lift Co");
      expect(card).to.contain(`Available from ${date(eta)}.`);
      expect(card).to.not.contain(CARRY);
      await advance(ethers, await s.contracts.governance.TIMELOCK_DELAY());
      ({ html } = await render(signers.stranger.address, "#/actions"));
      card = section(html, "Carry out ready proposals");
      expect(card).to.contain(CARRY);
      await (await governance.execute(3n)).wait();
      ({ html } = await render(signers.stranger.address, "#/actions"));
      expect(html).to.not.contain(CARRY);
    });

    it("offers Carry out to a queued Work proposal only after its wait and the firm's confirmation", async () => {
      const { ethers, signers, contracts, addresses, render } = await setUp();
      const { governance } = contracts;
      await governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await governance.VOTING_PERIOD());
      await governance.connect(signers.stranger).queue(2);
      const carry = async () => section((await render(signers.stranger.address, "#/actions")).html, "Carry out ready proposals");
      // Waiting for the date, and for the firm, as the preview words it.
      let card = await carry();
      expect(card).to.match(/Available from \d{1,2} [A-Z][a-z]{2} \d{4}, after the firm confirms the work is done\./);
      expect(card).to.not.contain(CARRY);
      await advance(ethers, await governance.TIMELOCK_DELAY());
      card = await carry();
      // The firm's to move now, so it is not anyone's action.
      expect(card).to.not.contain("Roof repair");
      expect(card).to.not.contain(CARRY);
      expect(card).to.contain("No proposal is waiting to be carried out.");
      await governance.connect(signers.firm).attest(2, id("evidence: roof"));
      card = await carry();
      expect(card).to.contain(CARRY);
      await (await new Contract(addresses.governance, ABI, signers.stranger).execute(2n)).wait();
      expect(await carry()).to.not.contain("Roof repair");
    });

    it("offers no button to a wallet on the wrong chain, and shows the wait on the action being signed", async () => {
      const { ethers, signers, contracts, render } = await setUp();
      await contracts.governance.connect(signers.bob).castVote(2, true);
      await advance(ethers, await contracts.governance.VOTING_PERIOD());
      const { view } = await render(signers.stranger.address, "#/actions");
      const h = (props: object) =>
        renderToStaticMarkup(createElement(App, { hash: "#/actions", view, ...props }));
      expect(h({ onAct: () => {} })).to.contain(QUEUE);
      const wrong = { kind: "browser", account: signers.stranger.address, chainId: 1n, deploymentChainId: 31337n } as const;
      expect(h({ wallet: wrong, onAct: () => {} })).to.not.contain(QUEUE);
      const busy = h({ onAct: () => {}, acting: { action: "queue", id: 2n } });
      expect(busy).to.contain("Waiting for your wallet…");
      expect(busy).to.not.contain(QUEUE);
    });
  });

  describe("Firm workspace (#157)", () => {
    const DAY = 24n * 60n * 60n;
    const CONTROLS = /<(?:input|textarea|select)\b|<button class="btn" type="submit"/g;
    const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // The Firm screen as `viewer` sees it, with the firm's address from the
    // deployment file. `onFirm` is given as App gives it to the firm's wallet.
    async function firmPage(s: Awaited<ReturnType<typeof setUp>>, viewer?: string, wallet?: Wallet) {
      const { view } = await s.render(viewer, "#/firm");
      const html = renderToStaticMarkup(
        createElement(App, {
          hash: "#/firm", view, wallet, firm: s.signers.firm.address,
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

    it("FR16, FR17: enables the forms for the firm's wallet only, and states the firm's limits to everyone", async () => {
      const s = await setUp();
      const { firm, alice, stranger } = s.signers;
      const limits = "You can propose, confirm and collect levies. You cannot move money out.";
      const own = await firmPage(s, firm.address);
      expect(own.html).to.not.contain("disabled");
      expect(own.html).to.contain("Management firm");
      expect(text(own.html)).to.contain(limits);
      for (const viewer of [alice.address, stranger.address, undefined]) {
        const { html } = await firmPage(s, viewer);
        // Every control is disabled, Collect included, and the same limits
        // stand.
        expect(html.match(CONTROLS)!.length).to.equal(10);
        expect(html.match(/disabled=""/g)!.length).to.equal(11);
        expect(text(html)).to.contain(limits);
        expect(html).to.not.contain("Management firm");
      }
      // No firm in the config and no viewer must not match each other.
      const { view } = await s.render(undefined, "#/firm");
      const none = renderToStaticMarkup(createElement(App, { hash: "#/firm", view, onFirm: { onWork() {}, onVendor() {}, onConfirm() {}, onCollect() {} } }));
      expect(none.match(/disabled=""/g)!.length).to.equal(11);
      // The firm's wallet on another chain is offered nothing either.
      const wrong = { kind: "browser", account: firm.address, chainId: 1n, deploymentChainId: 31337n } as const;
      expect((await firmPage(s, firm.address, wrong)).html).to.contain('disabled=""');
    });

    it("lists only admitted vendors, by name, in the vendor select", async () => {
      const s = await setUp();
      const { governance } = s.contracts;
      // Proposed but not admitted: it must not be offered.
      await governance.connect(s.signers.firm).getFunction("propose(address,string,string)")(s.signers.alice.address, "Lift Co", "NZBN 1");
      const { html } = await firmPage(s, s.signers.firm.address);
      const select = html.split('id="f-ven"')[1].split("</select>")[0];
      expect([...select.matchAll(/<option value="(0x\w+)">([^<]*)<\/option>/g)].map(([, v, n]) => [v, n])).to.deep.equal([[s.signers.vendor.address, "Harbour Lifts Ltd"]]);
    });

    it("ADR-020: lists every unpaid charge without its unit or amount, and offers Collect for the due ones", async () => {
      const s = await setUp();
      const { view, html } = await firmPage(s, s.signers.firm.address);
      // Charges 1 and 3 were collected and not covered; 4 is not yet due.
      expect(view.toCollect.map((c) => [c.chargeId, c.due, c.attempted])).to.deep.equal([
        [1n, true, true],
        [3n, true, true],
        [4n, false, false],
      ]);
      const card = html.split('<h2 class="card-title">Collect due levies</h2>')[1].split("</section>")[0];
      expect(card).to.not.match(/Unit \d|NZD/);
      expect(text(card)).to.contain("Charge #1");
      expect(text(card)).to.contain("Not covered when last collected");
      expect(text(card)).to.contain(`Available from ${date(view.toCollect[2].dueDate)}`);
      expect(card).to.contain('<button class="btn" type="button">Collect 2 due charges</button>');
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
      await (await ledger.collect([1n, 3n, 4n])).wait();

      const own = await s.render(alice.address, "#/units");
      expect(own.view.ownUnits.map((u) => [u.unitId, u.status, u.charges.length])).to.deep.equal([
        [1n, "current", 0],
        [2n, "current", 0],
      ]);
      const { view } = await firmPage(s, firm.address);
      expect(view.toCollect.map((c) => [c.chargeId, c.attempted])).to.deep.equal([[3n, true]]);
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

    it("ADR-020: Set up direct debit approves the levy ledger for the owner's unpaid total", async () => {
      const s = await setUp();
      const units = async (viewer: string, props: object = {}) =>
        renderToStaticMarkup(
          createElement(App, { hash: "#/units", view: (await s.render(viewer, "#/units")).view, onDebit() {}, ...props }),
        );
      // Alice's unpaid charges are 1 and 4, NZD 250.00 each.
      const html = await units(s.signers.alice.address);
      expect(text(html)).to.contain("take up to NZD 500.00, your unpaid charges");
      expect(html).to.contain('<button class="btn" type="button">Set up direct debit</button>');
      expect(await units(s.signers.stranger.address)).to.not.contain("Set up direct debit");
      const busy = await units(s.signers.alice.address, { acting: { action: "debit", id: 0n } });
      expect(busy).to.contain("Waiting for your wallet…");
      expect(busy).to.not.contain(">Set up direct debit<");
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
      const { view } = await s.render(firm.address, "#/firm");
      const [paint, stair] = view.proposals.slice(-2);
      expect([paint.kind, paint.description, paint.limit, paint.fund, paint.payee]).to.deep.equal(["Work", "Paint the stairwell", work!.limit, 1n, vendor.address]);
      expect([stair.kind, stair.description, stair.payee]).to.deep.equal(["Admit", "Stair Paint Ltd", carol.address]);
    });

    it("NotFirm and VendorNameIsEmpty show their RefusalNotice messages", async () => {
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
      expect((noId.notice as { code: string }).code).to.equal("CompanyIdIsEmpty");
    });

    it("FR25: Confirm is aria-disabled with its date until the wait ends, then enabled, and attest succeeds", async () => {
      const s = await setUp();
      const { firm } = s.signers;
      const eta = await queueRoofRepair(s);
      const confirm = (html: string) => html.split("Confirm work is done</button>")[0].split("<button").pop()!;
      let { html } = await firmPage(s, firm.address);
      expect(text(html)).to.contain(`#2 Roof repair Queued Up to ${nzd(400n * 10n ** 18n)} from Operating to Harbour Lifts Ltd.`);
      expect(confirm(html)).to.contain('aria-disabled="true"');
      expect(text(html)).to.contain(`Available from ${date(eta)}, when the 7-day wait ends.`);
      await advance(s.ethers, await s.contracts.governance.TIMELOCK_DELAY());
      ({ html } = await firmPage(s, firm.address));
      expect(confirm(html)).to.not.contain("aria-disabled");
      expect(text(html)).to.not.contain("Available from");
      const evidence = checkEvidence(id("evidence: roof"));
      expect(evidence).to.equal(undefined);
      const asFirm = new Contract(s.addresses.governance, ABI, firm);
      const done = await outcome(confirmWork(2n), () => asFirm.attest(2n, id("evidence: roof")));
      expect(done.toast).to.deep.equal({ title: "Work confirmed", body: "The work on Proposal #2 is confirmed as done." });
      const after = await firmPage(s, firm.address);
      expect(after.view.toConfirm).to.deep.equal([]);
      expect(text(after.html)).to.contain("No work is waiting to be confirmed.");
    });

    it("lists only queued Work proposals the firm has not confirmed, and no Admit proposal", async () => {
      const s = await setUp();
      // Open: not listed. Proposal 1 (Admit, executed) never is.
      expect((await s.render(s.signers.firm.address)).view.toConfirm).to.deep.equal([]);
      await queueRoofRepair(s);
      expect((await s.render(s.signers.firm.address)).view.toConfirm.map((c) => c.id)).to.deep.equal([2n]);
    });

    it("catches a malformed hash, address or cap before anything is sent, and leaves emptiness to the contract", () => {
      const ok = { description: "", cap: "10", fund: "0", vendor: ZERO, quote: id("q") };
      expect(checkWork(ok).work).to.not.equal(undefined);
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

  it("FR40: Home's queued-to-pay figure is the sum of the Queued limits on that fund, from events", async () => {
    const { ethers, contracts, signers, render } = await setUp();
    const { governance } = contracts;
    let { view, html } = await render(signers.carol.address);
    expect(view.queued).to.deep.equal({ operating: 0n, maintenance: 0n });
    expect(html).to.contain('Queued to pay, at most: <b class="num">none</b>');

    // Bob and carol vote with alice, so quorum holds and the window closes
    // without an extension; anyone then queues it.
    await governance.connect(signers.bob).castVote(2, true);
    await governance.connect(signers.carol).castVote(2, true);
    await advance(ethers, await governance.VOTING_PERIOD());
    await governance.connect(signers.stranger).queue(2);
    ({ view, html } = await render(signers.carol.address));
    expect(view.queued).to.deep.equal({
      operating: parseUnits("400", 18),
      maintenance: 0n,
    });
    expect(html).to.contain(
      `Queued to pay, at most: <b class="num">${nzd(parseUnits("400", 18))}</b>`,
    );
    // The other fund has nothing queued.
    expect(
      html.match(/Queued to pay, at most: <b class="num">none<\/b>/g),
    ).to.have.length(1);
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

    // Carol's unit has not voted on proposal 2; alice's both have.
    let { view, html } = await render(signers.carol.address);
    expect(view.proposals.find((p) => p.id === 2n)?.closes).to.equal(closes);
    expect(html).to.contain(`Voting closes ${date(closes)}.`);
    expect(html).to.contain('<span class="muted-text">1 proposal</span>');
    // Home links to the proposal and offers no action (interface.md §4).
    expect(html).to.contain('<a href="#/proposal/2">Roof repair</a>');
    expect(html).to.not.contain("<form");
    ({ html } = await render(signers.alice.address));
    expect(html).to.contain('<span class="muted-text">0 proposals</span>');
    expect(html).to.contain("Nothing needs your vote.");

    // One wallet voted, so no quorum: voting extends by seven days.
    await advance(ethers, window);
    ({ view, html } = await render(signers.carol.address));
    const extended = closes + 7n * 86_400n;
    expect(view.proposals.find((p) => p.id === 2n)?.closes).to.equal(extended);
    expect(html).to.contain(`Voting closes ${date(extended)}.`);
  });

  it("shows the viewer's own units and the Guarantees line on Home", async () => {
    const { signers, render } = await setUp();
    const { html } = await render(signers.alice.address);
    expect(html).to.contain('<h2 id="h-units">Your levies</h2>');
    expect(html).to.match(
      /Unit 1<\/h3><span class="status" data-tone="ok">current/,
    );
    expect(html).to.match(
      /Unit 2<\/h3><span class="status" data-tone="late">in arrears/,
    );
    expect(html).to.contain("Charge #1 · was due");
    expect(html).to.not.contain("Unit 3");
    expect(html).to.contain("The contract protects the money:");
    for (const g of [
      "Approved proposal",
      "Approved vendor",
      "Within the cap",
      "Right fund",
    ]) {
      expect(html).to.contain(`<summary>${g}</summary>`);
    }
  });

  it("offers a vote only to a unit that has not voted, and only while voting is open", async () => {
    const { signers, render } = await setUp();
    // Carol's unit has not voted on proposal 2; alice's both have.
    const at = "#/proposal/2";
    expect((await render(signers.carol.address, at)).html).to.match(
      /<form class="vote" data-proposal="2">/,
    );
    expect((await render(signers.alice.address, at)).html).to.not.contain(
      "<form",
    );
    // A wallet with no unit cannot vote at all.
    expect((await render(signers.stranger.address, at)).html).to.not.contain(
      "<form",
    );
  });

  it("Home leaves Your levies out when the viewer holds no unit", async () => {
    const { signers, render } = await setUp();
    const { html } = await render(signers.stranger.address);
    expect(html).to.not.contain("Your levies");
  });

  it("FR40: a queued long-term maintenance proposal is on that fund's card and not Operating's", async () => {
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
    for (const owner of [signers.alice, signers.bob, signers.carol]) {
      await governance.connect(owner).castVote(3, true);
    }
    await advance(ethers, await governance.VOTING_PERIOD());
    await governance.connect(signers.stranger).queue(3);
    const { view, html } = await render(signers.carol.address);
    expect(view.queued).to.deep.equal({
      operating: 0n,
      maintenance: parseUnits("900", 18),
    });
    const cards = html.split('<section class="card fund"').slice(1);
    expect(cards).to.have.length(2);
    expect(cards[0]).to.contain("Operating");
    expect(cards[0]).to.contain('Queued to pay, at most: <b class="num">none');
    expect(cards[1]).to.contain("Long-term maintenance");
    expect(cards[1]).to.contain(
      `Queued to pay, at most: <b class="num">${nzd(parseUnits("900", 18))}</b>`,
    );
  });

  describe("Proposal screen (#152)", () => {
    // The timeline's steps as rendered: [status, name, date text].
    const timeline = (html: string) =>
      [
        ...html.matchAll(
          /<li data-step="(\w+)"><span class="t-name">([^<]*)<\/span>(?:<span class="t-date">([^<]*)<\/span>)?/g,
        ),
      ].map(([, step, name, when]) => [step, name, when]);
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
      // Alice's two units are one wallet: units are met, owners are not.
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
      // Proposal 4 is voted down by three wallets: quorum met, and Failed.
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
      for (const owner of [signers.alice, signers.bob, signers.carol]) {
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

    it("draws the timeline from stateAt and block times, and waives quorum in the extension", async () => {
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
      const names = (html: string) =>
        timeline(html).map(([s, n]) => `${s} ${n}`);

      let { html } = await render(signers.carol.address, "#/proposal/2");
      expect(timeline(html)).to.deep.equal([
        ["done", "Proposed", date(createdAt)],
        ["current", "Open", `Closes ${date(createdAt + window)}`],
        ["skipped", "Extended", undefined],
        ["todo", "Passed", undefined],
        ["todo", "Queued", undefined],
        ["todo", "Firm confirms work", undefined],
        ["todo", "Executed", undefined],
      ]);
      expect(html).to.contain("Only if too few owners vote");
      expect(html).to.contain("Where it is");
      expect(html).to.contain(
        `Next date: voting closes ${date(createdAt + window)}.`,
      );
      expect(html).to.not.contain("Quorum waived");

      // One wallet voted: voting extends, and quorum is waived.
      await advance(ethers, window);
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(names(html).slice(0, 4)).to.deep.equal([
        "done Proposed",
        "done Open",
        "current Extended",
        "todo Passed",
      ]);
      expect(timeline(html)[2][2]).to.equal(
        `Closes ${date(createdAt + window + extension)}`,
      );
      expect(html).to.contain(
        '<span class="t-note">Quorum waived. One owner\'s vote can decide.</span>'.replace(
          "'",
          "&#x27;",
        ),
      );
      // The meter is replaced by the design system's waived notice.
      expect(html).to.not.contain("quorum-row");
      expect(html).to.contain(
        '<p class="quorum-waived"><b>Quorum waived.</b> Too few owners voted in the first 14 days, so voting was extended 7 days and quorum no longer applies. One owner’s vote can decide. This is deliberate and lawful.</p>',
      );

      await advance(ethers, extension);
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(names(html).slice(0, 4)).to.deep.equal([
        "done Proposed",
        "done Open",
        "done Extended",
        "current Passed",
      ]);
      // Voting is over, so no one is offered a vote.
      expect(html).to.not.contain("<form");
    });

    it("follows a proposal through queueing, confirmation and payment, and a failure", async () => {
      const { ethers, contracts, signers, render } = await setUp();
      const { governance } = contracts;
      await governance.connect(signers.bob).castVote(2, true);
      await governance.connect(signers.carol).castVote(2, false);
      await advance(ethers, await governance.VOTING_PERIOD());
      const queued = await governance.connect(signers.stranger).queue(2);
      // The wait ends a fixed delay after the block that queued it.
      const eta =
        (await block(ethers, (await queued.wait())!.blockNumber)) +
        (await governance.TIMELOCK_DELAY());
      let { html } = await render(signers.carol.address, "#/proposal/2");
      const steps = () => timeline(html).map(([s, n]) => `${s} ${n}`);
      const dates = () => timeline(html).map(([, , when]) => when);
      expect(steps()).to.deep.equal([
        "done Proposed",
        "done Open",
        "skipped Extended",
        "done Passed",
        "current Queued",
        "todo Firm confirms work",
        "todo Executed",
      ]);
      expect(dates().slice(3)).to.deep.equal([
        date(eta - (await governance.TIMELOCK_DELAY())),
        `Wait ends ${date(eta)}`,
        `From ${date(eta)}`,
        undefined,
      ]);
      expect(html).to.contain("Not needed: quorum was met");
      await advance(ethers, await governance.TIMELOCK_DELAY());
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(steps()[4]).to.equal("done Queued");
      expect(steps()[5]).to.equal("current Firm confirms work");
      const attested = await governance
        .connect(signers.firm)
        .attest(2, zeroPadValue("0x05", 32));
      const attestedAt = await block(
        ethers,
        (await attested.wait())!.blockNumber,
      );
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(steps().slice(-2)).to.deep.equal([
        "done Firm confirms work",
        "current Executed",
      ]);
      expect(dates()[5]).to.equal(`Confirmed ${date(attestedAt)}`);
      // Executed: nothing is pending, so every reached step is done.
      const executed = await governance.connect(signers.stranger).execute(2);
      const executedAt = await block(
        ethers,
        (await executed.wait())!.blockNumber,
      );
      ({ html } = await render(signers.carol.address, "#/proposal/2"));
      expect(steps()).to.deep.equal([
        "done Proposed",
        "done Open",
        "skipped Extended",
        "done Passed",
        "done Queued",
        "done Firm confirms work",
        "done Executed",
      ]);
      expect(dates()[6]).to.equal(date(executedAt));

      // Proposal 1 admitted a vendor: no firm step. Proposal 3 fails.
      ({ html } = await render(signers.carol.address, "#/proposal/1"));
      expect(steps()).to.not.include("done Firm confirms work");
      expect(steps().at(-1)).to.equal("done Executed");
      await governance
        .connect(signers.firm)
        .getFunction("propose(string,uint256,uint8,address,bytes32)")(
        "Paint the hallway",
        parseUnits("100", 18),
        0,
        signers.vendor.address,
        zeroPadValue("0x04", 32),
      );
      await governance.connect(signers.alice).castVote(3, false);
      await governance.connect(signers.bob).castVote(3, true);
      await governance.connect(signers.carol).castVote(3, false);
      await advance(ethers, await governance.VOTING_PERIOD());
      ({ html } = await render(signers.carol.address, "#/proposal/3"));
      expect(steps()).to.deep.equal([
        "done Proposed",
        "done Open",
        "skipped Extended",
        "current Failed",
        "skipped Queued",
        "skipped Firm confirms work",
        "skipped Executed",
      ]);
    });

    it("shows the tally in units, the rule that a tie fails, and both quorum bars", async () => {
      const { signers, render } = await setUp();
      const { view, html } = await render(
        signers.carol.address,
        "#/proposal/2",
      );
      const p = view.proposals.find((x) => x.id === 2n)!;
      // Alice's two units voted for it.
      expect([p.forVotes, p.againstVotes]).to.deep.equal([2n, 0n]);
      expect(html).to.contain(
        '<div class="tally-side"><span>For</span><b>2</b><span>units</span></div>',
      );
      expect(html).to.contain(
        '<div class="tally-side"><span>Against</span><b>0</b><span>units</span></div>',
      );
      expect(html).to.contain("A tie fails.");
      // The quote's hash is shortened like an address, with its own Copy.
      expect(html).to.contain("<dt>Quote hash</dt>");
      expect(html).to.contain('aria-label="Copy quote hash"');
      expect(html).to.contain(
        `${p.quoteHash.slice(0, 6)}…${p.quoteHash.slice(-4)}`,
      );
      // One unit is a quarter of four; one wallet is not two.
      expect(html).to.contain("<b>2 of 1</b> units");
      // The visible count is uncapped, the meter's value is not.
      expect(html).to.contain('aria-valuemax="1" aria-valuenow="1"');
      expect(html).to.contain("<b>1 of 2</b> owners");
      expect(html).to.match(/data-tone="ok">met<\/span>/);
      expect(html).to.match(/data-tone="wait">not yet met<\/span>/);
    });

    it("the vote control names the viewer's units that have not voted", async () => {
      const { signers, render } = await setUp();
      let { html } = await render(signers.carol.address, "#/proposal/2");
      expect(html).to.contain(
        '<p class="vote-units">You hold <b>1 unit</b> that has not voted: Unit 4.</p>',
      );
      expect(html).to.contain('value="true" name="inFavour"');
      expect(html).to.contain('value="false" name="inFavour"');
      // While the wallet signs, the buttons are the spinner and a disabled one.
      const { view } = await render(signers.carol.address);
      html = renderToStaticMarkup(
        createElement(App, { hash: "#/proposal/2", view, voting: 2n }),
      );
      expect(html).to.contain("Waiting for your wallet…");
      expect(html).to.not.contain('name="inFavour"');
      // A wrong-chain browser wallet is offered no vote.
      ({ html } = await render(signers.carol.address, "#/proposal/2", {
        kind: "browser",
        account: signers.carol.address,
        chainId: 1n,
        deploymentChainId: 31337n,
      }));
      expect(html).to.not.contain("<form");
    });

    it("says plainly that a proposal does not exist", async () => {
      const { signers, render } = await setUp();
      const { html } = await render(signers.carol.address, "#/proposal/99");
      expect(html).to.contain("<h1>Proposal #99</h1>");
      expect(html).to.contain("There is no proposal #99.");
    });
  });

  describe("Activity (#155)", () => {
    // The rows as a viewer reads them, newest first.
    const eventRows = (html: string) =>
      [
        ...html.matchAll(
          /<li class="event"><time>([^<]*)<\/time><span class="event-text">([^<]*)<\/span><span class="event-kind">([^<]*)<\/span><\/li>/g,
        ),
      ].map(([, time, text, kind]) => ({
        time,
        kind,
        text: text.replace(/&#x27;/g, "'"),
      }));
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
      const { html } = await render(signers.alice.address, "#/activity");
      const rows = eventRows(html);
      expect(html).to.contain('<ol class="events" reversed="">');
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
        "Unit 3 voted for Proposal #2 (1 unit).",
        "Units 1 and 2 voted for Proposal #2 (2 units).",
        "Unit 3 voted for Proposal #1 (1 unit).",
        "Units 1 and 2 voted for Proposal #1 (2 units).",
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

    it("NFR10: a levy event for another owner's unit names no unit, amount or charge, and with no viewer every levy event is anonymous", async () => {
      const { signers, contracts, render } = await finished();
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
        const { view, html } = await render(viewer?.address, "#/activity");
        const own = new Set(view.ownUnits.map((u) => u.unitId));
        const levy = eventRows(html).filter((r) => r.kind in anonymous);
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

  it("puts every route inside the shell with one current link, and keeps the privacy line on Register", async () => {
    const { signers, render } = await setUp();
    for (const [hash, heading, current] of ROUTES) {
      const { html } = await render(signers.alice.address, hash);
      expect(html, hash).to.match(/^<header class="shell-header">/);
      expect(html, hash).to.contain('<main class="shell-main">');
      expect(html, hash).to.contain(`<h1>${heading}</h1>`);
      const marked = [
        ...html.matchAll(/<a [^>]*aria-current="page"[^>]*>([^<]*)</g),
      ];
      expect(
        marked.map(([, label]) => label),
        hash,
      ).to.deep.equal([current]);
    }
    expect((await render(signers.alice.address, "#/register")).html).to.contain(
      PRIVACY_LINE,
    );
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

  it("shows the signing Dialog, the success Toast and a RefusalNotice in the design system's markup", () => {
    const html = (props: object) =>
      renderToStaticMarkup(createElement(App, { hash: "#/", ...props }));
    expect(
      html({ signing: "a vote for Proposal #2 with Units 1 and 2" }),
    ).to.contain(
      '<dialog class="dialog" aria-labelledby="signing-title"><p class="dialog-title" id="signing-title">Sign in your wallet</p><p class="muted-text" style="margin-top:8px">Your wallet is asking you to confirm a vote for Proposal #2 with Units 1 and 2.</p><div class="dialog-footer"><button class="btn" type="button" aria-disabled="true"><span class="spinner" aria-hidden="true"></span>Waiting for your wallet…</button></div></dialog>',
    );
    expect(html({})).to.not.contain("<dialog");
    expect(
      html({
        toast: {
          title: "Vote recorded",
          body: "Units 1 and 2 voted for Proposal #2.",
        },
      }),
    ).to.contain(
      '<div class="toast" role="status"><div><p class="alert-title">Vote recorded</p><p class="body-sm">Units 1 and 2 voted for Proposal #2.</p></div><button class="btn" data-variant="ghost" data-size="icon" type="button" aria-label="Dismiss">✕</button></div>',
    );
    expect(
      html({
        notice: {
          variant: "destructive",
          title: "Your vote was not recorded",
          description:
            "This wallet holds no unit in this building, so it cannot vote.",
          code: "NotBoundOwner",
        },
      }),
    ).to.contain(
      '<div class="alert" data-variant="destructive" role="alert"><p class="alert-title">Your vote was not recorded</p><p class="alert-description">This wallet holds no unit in this building, so it cannot vote.</p><p class="alert-code">Contract refusal: NotBoundOwner</p></div>',
    );
  });

  it("names a wallet on another chain and offers it nothing; asks an unconnected wallet to connect; tells a wallet with no unit", async () => {
    const { signers, render } = await setUp();
    const { carol, stranger } = signers;
    const browser = (account: string | undefined, chainId: bigint): Wallet => ({
      kind: "browser",
      account,
      chainId,
      deploymentChainId: 31337n,
    });

    // On chain 1, against a deployment on 31337: both ids named, and no
    // action — not carol's vote, which she could cast on the right chain,
    // and not Connect wallet.
    for (const account of [undefined, carol.address]) {
      const { html } = await render(
        account,
        "#/proposal/2",
        browser(account, 1n),
      );
      expect(html, account).to.contain(
        '<div class="alert" data-variant="destructive" role="alert"><p class="alert-title">Your wallet is on chain 1, and Kaitiaki is deployed on chain 31337.</p>',
      );
      expect(html, account).to.not.contain("<form");
      expect(html, account).to.not.contain("Connect wallet");
    }
    // The control: on the right chain, carol is offered her vote.
    expect(
      (
        await render(
          carol.address,
          "#/proposal/2",
          browser(carol.address, 31337n),
        )
      ).html,
    ).to.match(/<form class="vote" data-proposal="2">/);

    // On the right chain, not yet connected.
    for (const hash of ["#/", "#/units"]) {
      const { html } = await render(
        undefined,
        hash,
        browser(undefined, 31337n),
      );
      expect(html, hash).to.contain(
        '<h3 class="card-title">Connect your wallet to vote or pay</h3>',
      );
      expect(html, hash).to.contain(
        '<span class="wallet-slot"><button class="btn" type="button">Connect wallet</button></span>',
      );
    }

    // Connected, holding no unit.
    for (const hash of ["#/", "#/units"]) {
      const { html } = await render(
        stranger.address,
        hash,
        browser(stranger.address, 31337n),
      );
      expect(html, hash).to.contain(
        '<p class="alert-title">This wallet holds no unit in this building, so it cannot vote.</p>',
      );
      expect(html, hash).to.not.contain("<form");
      expect(html, hash).to.not.contain("Connect your wallet");
    }
  });

  it("shows the loading state until the log is read, and only the notice if reading fails", () => {
    const html = (props: object) =>
      renderToStaticMarkup(createElement(App, { hash: "#/", ...props }));
    expect(html({})).to.contain('<p role="status" class="row">');
    expect(html({})).to.contain("Reading the event log…");

    const failed = html({
      failed: true,
      notice: {
        variant: "destructive",
        title: "The event log could not be read.",
        description: "connection refused",
      },
    });
    expect(failed).to.not.contain("Reading the event log…");
    expect(failed).to.not.contain('class="skeleton"');
    expect(failed).to.contain(
      '<main class="shell-main"><div class="alert" data-variant="destructive" role="alert"><p class="alert-title">The event log could not be read.</p><p class="alert-description">connection refused</p></div></main>',
    );
  });

  it("points the Menu button at the Sheet only while the Sheet exists", () => {
    const html = renderToStaticMarkup(createElement(App, { hash: "#/" }));
    // Closed on first render, so the Sheet is not in the page.
    expect(html).to.not.contain('id="sheet"');
    expect(html).to.match(
      /<button class="btn nav-toggle" data-variant="outline" type="button" aria-label="Open menu" aria-expanded="false">Menu<\/button>/,
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
        // What the previous transaction left behind.
        toast: { title: "Vote recorded", body: "earlier" },
        notice: { variant: "destructive", title: "earlier", description: "" },
        reloads: 0,
      };
      const seen: Record<string, Record<string, unknown>> = {};
      const ui = {
        prompt,
        setSigning: (v?: string) => (state.signing = v),
        setToast: (v?: object) => (state.toast = v),
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

    it("shows the Dialog only while the wallet signs, then the Toast, then reads the log again", async () => {
      const { state, seen, ui, sign } = page(true);
      await send(VOTE, sign(async () => {}), ui);
      // The last transaction's Toast and notice go as the Dialog opens.
      expect(seen.signing).to.include({
        signing: VOTE.signing,
        toast: undefined,
        notice: undefined,
      });
      // Signed: the chain, not the wallet, is what is left, and the log is
      // read only once the block has it.
      expect(seen.waiting).to.include({ signing: undefined, reloads: 0 });
      expect(state).to.deep.equal({
        signing: undefined,
        toast: VOTE.done,
        notice: undefined,
        reloads: 1,
      });
    });

    it("resolves true only when the transaction was mined, which is when a form is emptied", async () => {
      const ui = { prompt: false, setSigning() {}, setToast() {}, setNotice() {}, async reload() {} };
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
        toast: undefined,
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
      expect(state).to.include({ toast: VOTE.done, reloads: 1 });
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
