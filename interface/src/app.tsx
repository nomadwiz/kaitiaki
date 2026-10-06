// The interface's markup (#149, #176): the workspace the viewer's address
// chooses (ADR-021), its shell, and one of its screens, chosen by the
// address's hash. Every component is a pure function of its props, so
// test/interface.ts renders them with react-dom/server and checks exactly
// what a viewer would see.
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { type Acting, type OnAct } from "./screens/actions.js";
import { Activity } from "./screens/activity.js";
import { Firm, type FirmActs } from "./screens/firm.js";
import { Home } from "./screens/home.js";
import { Proposal } from "./screens/proposal.js";
import { Proposals } from "./screens/proposals.js";
import { Register } from "./screens/register.js";
import { YourUnits } from "./screens/units.js";
import { NAV, Shell, type Workspace } from "./shell.js";
import {
  Alert,
  ConnectWallet,
  Loading,
  NoUnit,
  SigningDialog,
  type Notice,
} from "./states.js";
import type { View } from "./view.js";

export type Wallet =
  // A browser wallet, through EIP-1193.
  | {
      kind: "browser";
      account: string | undefined;
      chainId: bigint;
      deploymentChainId: bigint;
    }
  // An account the local node unlocks, chosen with `?as=`.
  | { kind: "node" };

type Props = {
  hash: string;
  // Undefined while the event log is being read.
  view?: View;
  wallet?: Wallet;
  notice?: Notice;
  // What the wallet is signing, as the Dialog's sentence ends it.
  signing?: string;
  // The proposal whose vote the wallet is signing.
  voting?: bigint;
  // The charge whose payment the wallet is signing.
  paying?: bigint;
  // Reading failed: the notice says why, and nothing is loading.
  failed?: boolean;
  onConnect?: () => void;
  onVote?: (proposalId: bigint, inFavour: boolean) => void;
  onPay?: (unitId: bigint, chargeId: bigint, amount: bigint) => void;
  // Set up direct debit: approve the levy ledger for `total` (ADR-020).
  onDebit?: (total: bigint) => void;
  // The Queue or Carry out the wallet is signing, and the one pressed.
  acting?: Acting;
  onAct?: OnAct;
  // The firm's address, from the deployment file, and what its wallet can do.
  firm?: string;
  onFirm?: FirmActs;
  // Changes when a proposal form is to be emptied, after its send succeeded.
  fresh?: { work: number; vendor: number };
};

// What each screen is given, once the log has been read.
type Context = {
  view: View;
  id: string;
  canAct: boolean;
  voting?: bigint;
  onVote?: Props["onVote"];
  paying?: bigint;
  onPay?: Props["onPay"];
  onDebit?: Props["onDebit"];
  acting?: Props["acting"];
  onAct?: Props["onAct"];
  // Set only for the firm's wallet, on the deployment's chain.
  onFirm?: FirmActs;
  fresh?: Props["fresh"];
};

// Which workspace an address opens, in ADR-021's order: the firm's address
// from the deployment file, even if it holds units; then an address with a
// UnitBound event; then any other address; then no wallet.
export function workspaceOf(
  viewer: string | undefined,
  firm: string | undefined,
  ownUnits: unknown[],
): Workspace | "no-unit" | "connect" {
  if (!viewer) return "connect";
  if (viewer.toLowerCase() === firm?.toLowerCase()) return "firm";
  return ownUnits.length ? "owner" : "no-unit";
}

const proposals = (workspace: Workspace) => (c: Context) => (
  <Proposals
    workspace={workspace}
    proposals={c.view.proposals}
    actions={c.view.actions}
    onAct={c.canAct ? c.onAct : undefined}
    acting={c.acting}
  />
);
// The firm's screens are one until #182, #184 and #185 split them.
const firm = (c: Context) => (
  <Firm
    vendors={c.view.vendors}
    toConfirm={c.view.toConfirm}
    toCollect={c.view.toCollect}
    act={c.onFirm}
    acting={c.acting}
    fresh={c.fresh}
  />
);

// Each workspace's routes. `#/proposal/<n>` is in both, keyed as "proposal"
// so no hash names it directly.
const SCREENS: Record<Workspace, Record<string, (c: Context) => ReactNode>> = {
  owner: {
    "#/": (c) => (
      <Home
        funds={c.view.funds}
        proposals={c.view.proposals}
        ownUnits={c.view.ownUnits}
      />
    ),
    "#/proposals": proposals("owner"),
    "#/units": (c) => (
      <YourUnits
        units={c.view.ownUnits}
        onPay={c.canAct ? c.onPay : undefined}
        paying={c.paying}
        onDebit={c.canAct ? c.onDebit : undefined}
        acting={c.acting}
      />
    ),
    "#/building": (c) => (
      <Register units={c.view.otherUnits} vendors={c.view.vendors} />
    ),
    "#/activity": (c) => <Activity events={c.view.activity} />,
  },
  firm: {
    "#/": firm,
    "#/proposals": proposals("firm"),
    "#/propose": firm,
    "#/collect": firm,
    "#/vendors": firm,
    "#/activity": (c) => <Activity events={c.view.activity} />,
  },
};
// The firm's address is offered no vote, even if it holds units (ADR-021).
for (const [workspace, routes] of Object.entries(SCREENS)) {
  routes.proposal = (c) => {
    const p = c.view.proposals.find((p) => String(p.id) === c.id);
    return (
      <Proposal
        id={c.id}
        proposal={p && workspace === "firm" ? { ...p, canVote: false } : p}
        canAct={c.canAct}
        voting={c.voting}
        onVote={c.onVote}
      />
    );
  };
}

export const ELSEWHERE =
  "That page belongs to another workspace. Kaitiaki opened your Home instead.";
// Whether `hash` is a route of the other workspace only, which opens this
// one's Home.
export const isElsewhere = (workspace: Workspace, hash: string) =>
  !Object.hasOwn(SCREENS[workspace], hash) &&
  Object.values(SCREENS).some((r) => Object.hasOwn(r, hash));

export function App({
  hash,
  view,
  wallet,
  notice,
  signing,
  voting,
  paying,
  failed,
  onConnect,
  onVote,
  onPay,
  onDebit,
  acting,
  onAct,
  firm,
  onFirm,
  fresh,
}: Props) {
  const browser = wallet?.kind === "browser" ? wallet : undefined;
  const viewer = browser ? browser.account : view?.viewer;
  // A wallet on another chain than the deployment's is offered no action.
  const wrongChain = browser && browser.chainId !== browser.deploymentChainId;
  const canConnect = browser && !viewer && !wrongChain;
  const workspace = view && workspaceOf(viewer, firm, view.ownUnits);
  const routes =
    workspace === "owner" || workspace === "firm" ? SCREENS[workspace] : {};
  const id = /^#\/proposal\/(\d+)$/.exec(hash)?.[1];
  const route = id ? "proposal" : Object.hasOwn(routes, hash) ? hash : "#/";
  // A route of the other workspace opens this one's Home, and a toast says
  // so once on arrival. react-dom/server never runs an effect.
  const elsewhere =
    (workspace === "owner" || workspace === "firm") &&
    isElsewhere(workspace, hash);
  useEffect(() => {
    if (elsewhere) toast(ELSEWHERE, { id: ELSEWHERE });
  }, [elsewhere, hash]);
  // A proposal, and Propose work, are reached from Proposals, which stays
  // the current link.
  const current = id || route === "#/propose" ? "#/proposals" : route;

  const notices = (
    <>
      {wrongChain && (
        <Alert
          variant="warning"
          title={`Your wallet is on chain ${browser.chainId}.`}
          description={`Switch it to chain ${browser.deploymentChainId} to act.`}
        />
      )}
      {notice && <Alert {...notice} />}
    </>
  );

  let page: ReactNode;
  if (!view || !workspace) {
    page = (
      <main className="shell-main">
        {notices}
        {!failed && <Loading />}
      </main>
    );
  } else if (workspace === "connect" || workspace === "no-unit") {
    // The entry screens show no navigation and no building data (#186).
    page = (
      <main className="shell-main">
        {notices}
        {workspace === "no-unit" ? (
          <NoUnit />
        ) : (
          canConnect && <ConnectWallet onConnect={onConnect} />
        )}
      </main>
    );
  } else {
    page = (
      <Shell
        workspace={workspace}
        current={NAV[workspace].some(([href]) => href === current) ? current : "#/"}
        viewer={viewer!}
        units={view.ownUnits.map((u) => u.unitId)}
      >
        {notices}
        {routes[route]({
          view,
          id: id ?? "",
          canAct: !wrongChain,
          voting,
          onVote,
          paying,
          onPay,
          onDebit,
          acting,
          onAct,
          onFirm: !wrongChain && workspace === "firm" ? onFirm : undefined,
          fresh,
        })}
      </Shell>
    );
  }

  return (
    <>
      {page}
      {signing && <SigningDialog key={signing} signing={signing} />}
    </>
  );
}
