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

const injected = (
  window as {
    ethereum?: Eip1193Provider & {
      on(event: string, listener: () => void): void;
    };
  }
).ethereum;
// A new account or network makes everything shown stale.
injected?.on("accountsChanged", () => location.reload());
injected?.on("chainChanged", () => location.reload());
const as = new URLSearchParams(location.search).get("as") ?? undefined;

// What the page needs before it can read: the deployment file and, with a
// browser wallet, its account and chain. Started at once; the root is
// mounted without waiting, so the loading state shows meanwhile.
async function start() {
  const response = await fetch("/deployment.json");
  if (!response.ok) {
    throw new Error(`deployment.json: HTTP ${response.status}`);
  }
  const config: Config = await response.json();
  const browserWallet = injected && new BrowserProvider(injected);
  // `eth_accounts` never prompts; the wallet is asked to connect only when
  // the viewer presses Connect wallet.
  const [connected]: (string | undefined)[] = browserWallet
    ? await browserWallet.send("eth_accounts", [])
    : [];
  return {
    config,
    reader: new JsonRpcProvider(config.rpcUrl),
    browserWallet,
    connected,
    walletChainId: browserWallet
      ? BigInt(await browserWallet.send("eth_chainId", []))
      : 0n,
  };
}
type Env = Awaited<ReturnType<typeof start>>;
const started = start();

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
  const [env, setEnv] = useState<Env>();
  const [log, setLog] = useState<{
    derived: Awaited<ReturnType<typeof replay>>;
    now: bigint;
  }>();
  const [failed, setFailed] = useState(false);
  const [account, setAccount] = useState<string>();
  const [chosen, setChosen] = useState(as);
  const [notice, setNotice] = useState<Notice>();
  const [voting, setVoting] = useState<bigint>();

  const fail = (title: string, error: unknown) => {
    setFailed(true);
    setNotice({ variant: "destructive", title, description: message(error) });
  };

  async function load({ config, reader }: Env) {
    try {
      const derived = await replay(reader, config.addresses, config.fromBlock);
      const now = BigInt((await reader.getBlock("latest"))!.timestamp);
      setLog({ derived, now });
    } catch (error) {
      fail("The event log could not be read.", error);
    }
  }
  useEffect(() => {
    started.then(
      (env) => {
        setEnv(env);
        setAccount(env.connected);
        return load(env);
      },
      (error) => fail("Kaitiaki could not start.", error),
    );
  }, []);

  let wallet: Wallet | undefined;
  let viewer: string | undefined;
  if (env?.browserWallet) {
    wallet = {
      kind: "browser",
      account,
      chainId: env.walletChainId,
      deploymentChainId: BigInt(env.config.chainId),
    };
    viewer = account;
  } else if (env) {
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
      const [first] = await env!.browserWallet!.send("eth_requestAccounts", []);
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
      const { browserWallet, reader, config } = env!;
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
    await load(env!);
  }

  return (
    <App
      hash={hash}
      view={view}
      wallet={wallet}
      notice={notice}
      voting={voting}
      failed={failed}
      onConnect={() => void connect()}
      onViewer={setChosen}
      onVote={(id, inFavour) => void vote(id, inFavour)}
    />
  );
}

createRoot(document.getElementById("app")!).render(<Root />);
