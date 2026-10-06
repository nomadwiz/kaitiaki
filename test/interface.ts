// The read interface, issues #72 and #149 (FR41, NFR10, information view R4).
//
// NFR10's stated method is an automated check over the rendered output for
// any digit in an arrears context. The interface is React, and each screen is
// a pure component of the view, so this renders it with react-dom/server and
// checks exactly the markup the browser is given, built from the event log of
// a building on the real contracts (scripts/building.ts).
import { expect } from "chai";
import { readFile, readdir } from "node:fs/promises";
import { network } from "hardhat";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { App, type Wallet } from "../interface/src/app.js";
import { date, nzd } from "../interface/src/format.js";
import { buildView } from "../interface/src/view.js";
import { deployBuilding } from "../scripts/building.js";
import { replay } from "../scripts/replay.js";

const STATES = ["Open", "Extended", "Passed", "Failed", "Queued", "Executed"];

// Each route, the heading its screen opens with, and the link marked current.
const ROUTES = [
  ["#/", "Home", "Home"],
  ["#/proposal/2", "Proposal #2", "Home"],
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
        html: renderToStaticMarkup(createElement(App, { hash, view, wallet })),
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

  it("shows the viewer's own arrears, and stops surfacing a resolved arrear (R4)", async () => {
    const { signers, contracts, render } = await setUp();
    const { alice, bob, carol } = signers;
    // An overdue charge on Your units: its amount, then its number and due
    // date.
    const overdue =
      /<p class="charge-amount">NZD 250\.00<\/p><p class="field-hint"[^>]*>Charge #1 · was due \d{1,2} [A-Z][a-z]{2} \d{4}<\/p>/;

    // Alice's unit 2 is overdue: her own page gives the amount and due date.
    let { view, html } = await render(alice.address, "#/units");
    expect(view.ownUnits.map((u) => [u.unitId, u.status])).to.deep.equal([
      [1n, "current"],
      [2n, "in arrears"],
    ]);
    expect(view.ownUnits[1].overdue.map((c) => c.chargeId)).to.deep.equal([1n]);
    expect(html).to.match(overdue);

    // Bob paid unit 3's charge late. That arrear is resolved, so it is
    // surfaced nowhere: not on his own page, not on anyone else's.
    ({ view } = await render(bob.address, "#/units"));
    expect(view.ownUnits).to.deep.equal([
      { unitId: 3n, status: "current", overdue: [] },
    ]);

    // Alice pays. Her arrear stops being surfaced to her and to others.
    await contracts.ledger.connect(alice).payLevy(1);
    ({ view, html } = await render(alice.address, "#/units"));
    expect(view.ownUnits[1]).to.deep.equal({
      unitId: 2n,
      status: "current",
      overdue: [],
    });
    expect(html).to.not.match(overdue);
    expect(html).to.not.contain("was due");
    ({ view } = await render(carol.address, "#/units"));
    expect(view.otherUnits.find((u) => u.unitId === 2n)?.status).to.equal(
      "current",
    );
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

  it("offers a vote only to a unit that has not voted, and only while voting is open", async () => {
    const { signers, render } = await setUp();
    // Carol's unit has not voted on proposal 2; alice's both have.
    expect((await render(signers.carol.address)).html).to.match(
      /<form class="vote" data-proposal="2">/,
    );
    expect((await render(signers.alice.address)).html).to.not.contain("<form");
    // A wallet with no unit cannot vote at all.
    expect((await render(signers.stranger.address)).html).to.not.contain(
      "<form",
    );
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

  it("FR41: holds no key, and knows no contract function but castVote", async () => {
    const dir = new URL("../interface/src/", import.meta.url);
    // Every source file, at any depth: a file that moves or changes
    // extension is still checked.
    const files = (await readdir(dir, { recursive: true })).filter((f) =>
      /\.tsx?$/.test(f),
    );
    // The one file that may name a contract function.
    const signer = "main.tsx";
    expect(files).to.include(signer);
    for (const file of files) {
      const source = await readFile(new URL(file, dir), "utf8");
      expect(source, file).to.not.match(/0x[0-9a-fA-F]{64}/);
      expect(source, file).to.not.match(/\bnew Wallet\b|privateKey|mnemonic/i);
      const fragments = [...source.matchAll(/"function [^"]*"/g)].map(
        ([f]) => f,
      );
      expect(fragments, file).to.deep.equal(
        file === signer
          ? [
              '"function castVote(uint256 proposalId, bool inFavour) returns (uint256)"',
            ]
          : [],
      );
    }
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
      const { html } = await render(account, "#/", browser(account, 1n));
      expect(html, account).to.contain(
        '<div class="alert" data-variant="destructive" role="alert"><p class="alert-title">Your wallet is on chain 1, and Kaitiaki is deployed on chain 31337.</p>',
      );
      expect(html, account).to.not.contain("<form");
      expect(html, account).to.not.contain("Connect wallet");
    }
    // The control: on the right chain, carol is offered her vote.
    expect(
      (await render(carol.address, "#/", browser(carol.address, 31337n))).html,
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
