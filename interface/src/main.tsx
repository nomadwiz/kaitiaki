// The read interface (#72, #149, FR41): reads events only and holds no key
// and no role. It reads through `replay`, which asks the node for logs and
// their blocks' headers and nothing else, plus the latest block's timestamp.
// Its one write is a vote, signed by the viewer's own wallet — a browser
// wallet through EIP-1193 if one is present, otherwise an account the local
// node itself unlocks, chosen with `?as=<address>`. The interface never sees
// a key. The markup is in app.tsx; this file holds the state.
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type Eip1193Provider,
  type Signer,
} from "ethers";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import { replay } from "../../scripts/replay.js";
import { App, type Wallet } from "./app.js";
import type { Notice } from "./states.js";
import { buildView } from "./view.js";

// Written by scripts/demo.ts. `token`, `timelock` and `firm` are there too,
// for the screens that need them.
type Config = {
  chainId: number;
  rpcUrl: string;
  fromBlock: number;
  addresses: Parameters<typeof replay>[1];
};

// The only contract function the interface knows: it cannot read storage
// through an ABI it does not have.
const VOTE_ABI = [
  "function castVote(uint256 proposalId, bool inFavour) returns (uint256)",
];

const config: Config = await (await fetch("/deployment.json")).json();
const reader = new JsonRpcProvider(config.rpcUrl);
const injected = (
  window as {
    ethereum?: Eip1193Provider & {
      on(event: string, listener: () => void): void;
    };
  }
).ethereum;
const browserWallet = injected && new BrowserProvider(injected);
// A new account or network makes everything shown stale.
injected?.on("accountsChanged", () => location.reload());
injected?.on("chainChanged", () => location.reload());
// `eth_accounts` never prompts; the wallet is asked to connect only when the
// viewer presses Connect wallet.
const [connected]: (string | undefined)[] = browserWallet
  ? await browserWallet.send("eth_accounts", [])
  : [];
const walletChainId = browserWallet
  ? BigInt(await browserWallet.send("eth_chainId", []))
  : 0n;
const as = new URLSearchParams(location.search).get("as") ?? undefined;

// The route is the address's hash.
// Source: https://react.dev/reference/react/useSyncExternalStore
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

const message = (error: unknown) =>
  (error as { shortMessage?: string }).shortMessage ?? String(error);

function Root() {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const [log, setLog] = useState<{
    derived: Awaited<ReturnType<typeof replay>>;
    now: bigint;
  }>();
  const [account, setAccount] = useState(connected);
  const [chosen, setChosen] = useState(as);
  const [notice, setNotice] = useState<Notice>();
  const [voting, setVoting] = useState<bigint>();

  async function load() {
    try {
      const derived = await replay(reader, config.addresses, config.fromBlock);
      const now = BigInt((await reader.getBlock("latest"))!.timestamp);
      setLog({ derived, now });
    } catch (error) {
      setNotice({
        variant: "destructive",
        title: "The event log could not be read.",
        description: message(error),
      });
    }
  }
  useEffect(() => void load(), []);

  let wallet: Wallet;
  let viewer: string | undefined;
  if (browserWallet) {
    wallet = {
      kind: "browser",
      account,
      chainId: walletChainId,
      deploymentChainId: BigInt(config.chainId),
    };
    viewer = account;
  } else {
    // Bound wallets, from UnitBound, each with its units. `?as=` picks one,
    // or any other address, so a page can be seen as any owner or none.
    const unitsOf = new Map<string, bigint[]>();
    for (const [unitId, w] of log?.derived.owners ?? []) {
      unitsOf.set(w, [...(unitsOf.get(w) ?? []), unitId]);
    }
    const choices = [...unitsOf].map(([address, units]) => ({
      address,
      units,
    }));
    const same = (c: { address: string }) =>
      c.address.toLowerCase() === chosen?.toLowerCase();
    if (log && chosen && !choices.some(same)) {
      choices.push({ address: chosen, units: [] });
    }
    wallet = { kind: "node", choices };
    viewer = (choices.find(same) ?? choices[0])?.address;
  }
  const view = log && buildView(log.derived, log.now, viewer);

  async function connect() {
    try {
      const [first] = await browserWallet!.send("eth_requestAccounts", []);
      setAccount(first);
    } catch (error) {
      setNotice({
        variant: "destructive",
        title: "The wallet did not connect.",
        description: message(error),
      });
    }
  }

  async function vote(proposalId: bigint, inFavour: boolean) {
    setVoting(proposalId);
    setNotice({
      variant: "default",
      title: `Sending your vote on proposal #${proposalId}…`,
      description: "Confirm it in your wallet.",
    });
    try {
      const signer: Signer = browserWallet
        ? await browserWallet.getSigner(account)
        : await reader.getSigner(viewer);
      const governance = new Contract(
        config.addresses.governance,
        VOTE_ABI,
        signer,
      );
      const tx = await governance.castVote(proposalId, inFavour);
      await tx.wait();
      setNotice({
        variant: "success",
        title: "Vote recorded",
        description: `Your units voted ${inFavour ? "for" : "against"} Proposal #${proposalId} in transaction ${tx.hash.slice(0, 6)}…${tx.hash.slice(-4)}.`,
      });
    } catch (error) {
      setNotice({
        variant: "destructive",
        title: "Your vote was not recorded",
        description: message(error),
      });
    }
    setVoting(undefined);
    await load();
  }

  return (
    <App
      hash={hash}
      view={view}
      wallet={wallet}
      notice={notice}
      voting={voting}
      onConnect={() => void connect()}
      onViewer={setChosen}
      onVote={(id, inFavour) => void vote(id, inFavour)}
    />
  );
}

createRoot(document.getElementById("app")!).render(<Root />);
