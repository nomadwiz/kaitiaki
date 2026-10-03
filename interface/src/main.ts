/// <reference lib="dom" />
// The read interface (#72, FR41): reads events only and holds no key and no
// role. It reads through `replay`, which asks the node for logs and their
// blocks' headers and nothing else, plus the latest block's timestamp. Its
// one write is a vote, signed by the viewer's own wallet — a browser wallet
// if one is present, otherwise an account the local node itself unlocks. The
// interface never sees a key.
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type Signer,
} from "ethers";

import { replay } from "../../scripts/replay.js";
import { renderBuilding } from "./render.js";
import { buildView } from "./view.js";

type Config = {
  rpcUrl: string;
  fromBlock: number;
  addresses: Parameters<typeof replay>[1];
};

// The only contract function the interface knows: it cannot read storage
// through an ABI it does not have.
const VOTE_ABI = [
  "function castVote(uint256 proposalId, bool inFavour) returns (uint256)",
];

const app = document.querySelector<HTMLElement>("#app")!;
const viewerSelect = document.querySelector<HTMLSelectElement>("#viewer")!;
const notice = document.querySelector<HTMLElement>("#notice")!;

const config: Config = await (await fetch("/deployment.json")).json();
const reader = new JsonRpcProvider(config.rpcUrl);
const injected = (window as { ethereum?: unknown }).ethereum;
const browserWallet = injected
  ? new BrowserProvider(
      injected as ConstructorParameters<typeof BrowserProvider>[0],
    )
  : undefined;

async function viewerSigner(): Promise<Signer> {
  if (browserWallet) return browserWallet.getSigner();
  return reader.getSigner(viewerSelect.value);
}

async function load() {
  const derived = await replay(reader, config.addresses, config.fromBlock);
  const now = BigInt((await reader.getBlock("latest"))!.timestamp);

  if (browserWallet) {
    const [account] = await browserWallet.send("eth_requestAccounts", []);
    viewerSelect.innerHTML = `<option>${account}</option>`;
    viewerSelect.disabled = true;
  } else if (!viewerSelect.options.length) {
    // Bound wallets, from UnitBound, each named with its units. `?as=` picks
    // one, so a screenshot can be taken as any owner.
    const unitsOf = new Map<string, bigint[]>();
    for (const [unitId, wallet] of derived.owners) {
      unitsOf.set(wallet, [...(unitsOf.get(wallet) ?? []), unitId]);
    }
    viewerSelect.innerHTML = [...unitsOf]
      .map(
        ([w, units]) =>
          `<option value="${w}">${w} (unit${units.length > 1 ? "s" : ""} ${units.join(", ")})</option>`,
      )
      .join("");
    const as = new URLSearchParams(location.search).get("as");
    if (as) viewerSelect.value = as;
  }

  const view = buildView(derived, now, viewerSelect.value || undefined);
  app.innerHTML = renderBuilding(view);
}

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const button = (event as SubmitEvent).submitter as HTMLButtonElement;
  const proposalId = BigInt(form.dataset.proposal!);
  const inFavour = button.value === "true";
  for (const b of form.querySelectorAll("button")) b.disabled = true;
  try {
    const governance = new Contract(
      config.addresses.governance,
      VOTE_ABI,
      await viewerSigner(),
    );
    notice.textContent = `Sending vote on proposal #${proposalId}…`;
    const tx = await governance.castVote(proposalId, inFavour);
    await tx.wait();
    notice.textContent = `Vote on proposal #${proposalId} recorded in transaction ${tx.hash}.`;
  } catch (error) {
    notice.textContent = `Vote refused: ${
      (error as { shortMessage?: string }).shortMessage ?? String(error)
    }`;
  }
  await load();
});

viewerSelect.addEventListener("change", () => void load());
await load();
