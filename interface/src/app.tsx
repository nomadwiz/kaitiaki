// The interface's markup (#149): the design system's AppShell around one of
// seven screens, chosen by the address's hash. Every component keeps the
// class names and attributes of the design system's previews
// (doc/asset/design-system/components/) and is a pure function of its props,
// so test/interface.ts renders them with react-dom/server and checks exactly
// what a viewer would see.
import type { ReactNode } from "react";

import { Actions, type Acting, type OnAct } from "./screens/actions.js";
import { Activity } from "./screens/activity.js";
import { Firm, type FirmActs } from "./screens/firm.js";
import { Home } from "./screens/home.js";
import { Proposal } from "./screens/proposal.js";
import { Register } from "./screens/register.js";
import { YourUnits } from "./screens/units.js";
import { AppShell, NAV, WalletSlot } from "./shell.js";
import {
  Alert,
  ConnectWallet,
  Loading,
  NoUnit,
  SigningDialog,
  Toast,
  type Done,
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
  // The local node's unlocked accounts, chosen with `?as=` or the select.
  | { kind: "node"; choices: { address: string; units: bigint[] }[] };

type Props = {
  hash: string;
  // Undefined while the event log is being read.
  view?: View;
  wallet?: Wallet;
  notice?: Notice;
  // What the wallet is signing, as the Dialog's sentence ends it.
  signing?: string;
  // The last transaction that succeeded, until dismissed or the next one.
  toast?: Done;
  onDismissToast?: () => void;
  // The proposal whose vote the wallet is signing.
  voting?: bigint;
  // The charge whose payment the wallet is signing.
  paying?: bigint;
  // Reading failed: the notice says why, and nothing is loading.
  failed?: boolean;
  onConnect?: () => void;
  onViewer?: (address: string) => void;
  onVote?: (proposalId: bigint, inFavour: boolean) => void;
  onPay?: (unitId: bigint, chargeId: bigint, amount: bigint) => void;
  // The Anyone's actions the wallet is signing, and the one pressed.
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
  walletState: ReactNode;
  voting?: bigint;
  onVote?: Props["onVote"];
  paying?: bigint;
  onPay?: Props["onPay"];
  acting?: Props["acting"];
  onAct?: Props["onAct"];
  // Set only for the firm's wallet, on the deployment's chain.
  onFirm?: FirmActs;
  fresh?: Props["fresh"];
};

const SCREENS: Record<string, (c: Context) => ReactNode> = {
  "#/": (c) => (
    <Home
      funds={c.view.funds}
      queued={c.view.queued}
      proposals={c.view.proposals}
      ownUnits={c.view.ownUnits}
    >
      {c.walletState}
    </Home>
  ),
  // Keyed without "#/", so no hash names it: only #/proposal/<n> reaches it.
  proposal: (c) => (
    <Proposal
      id={c.id}
      proposal={c.view.proposals.find((p) => String(p.id) === c.id)}
      canAct={c.canAct}
      voting={c.voting}
      onVote={c.onVote}
    />
  ),
  "#/units": (c) => (
    <YourUnits
      units={c.view.ownUnits}
      onPay={c.canAct ? c.onPay : undefined}
      paying={c.paying}
    >
      {c.walletState}
    </YourUnits>
  ),
  "#/register": (c) => <Register units={c.view.otherUnits} vendors={c.view.vendors} />,
  "#/activity": (c) => <Activity events={c.view.activity} />,
  "#/actions": (c) => (
    <Actions
      actions={c.view.actions}
      onAct={c.canAct ? c.onAct : undefined}
      acting={c.acting}
    />
  ),
  "#/firm": (c) => (
    <Firm
      vendors={c.view.vendors}
      toConfirm={c.view.toConfirm}
      act={c.onFirm}
      acting={c.acting}
      fresh={c.fresh}
    />
  ),
};

export function App({
  hash,
  view,
  wallet,
  notice,
  signing,
  toast,
  onDismissToast,
  voting,
  paying,
  failed,
  onConnect,
  onViewer,
  onVote,
  onPay,
  acting,
  onAct,
  firm,
  onFirm,
  fresh,
}: Props) {
  const id = /^#\/proposal\/(\d+)$/.exec(hash)?.[1];
  const route = id ? "proposal" : Object.hasOwn(SCREENS, hash) ? hash : "#/";
  // A proposal is reached from Home, so Home stays the current link.
  const current = NAV.some(([href]) => href === route) ? route : "#/";
  const browser = wallet?.kind === "browser" ? wallet : undefined;
  const viewer = browser ? browser.account : view?.viewer;
  // A wallet on another chain than the deployment's is offered no action.
  const wrongChain = browser && browser.chainId !== browser.deploymentChainId;
  const canConnect = browser && !viewer && !wrongChain;

  const walletState = canConnect ? (
    <ConnectWallet onConnect={onConnect} />
  ) : viewer && view?.ownUnits.length === 0 ? (
    <NoUnit />
  ) : null;

  return (
    <>
      <AppShell
        current={current}
        wallet={
          <WalletSlot
            viewer={viewer}
            units={view?.ownUnits.map((u) => u.unitId)}
            choices={wallet?.kind === "node" ? wallet.choices : undefined}
            canConnect={canConnect}
            onConnect={onConnect}
            onViewer={onViewer}
            firm={firm}
          />
        }
      />
      <main className="shell-main">
        {wrongChain && (
          <Alert
            variant="destructive"
            title={`Your wallet is on chain ${browser.chainId}, and Kaitiaki is deployed on chain ${browser.deploymentChainId}.`}
            description={`Switch your wallet to chain ${browser.deploymentChainId}. Nothing can be signed until then.`}
          />
        )}
        {notice && <Alert {...notice} />}
        {toast && <Toast {...toast} onDismiss={onDismissToast} />}
        {view
          ? SCREENS[route]({
              view,
              id: id ?? "",
              canAct: !wrongChain,
              walletState,
              voting,
              onVote,
              paying,
              onPay,
              acting,
              onAct,
              onFirm:
                !wrongChain &&
                !!firm &&
                !!viewer &&
                viewer.toLowerCase() === firm.toLowerCase()
                  ? onFirm
                  : undefined,
              fresh,
            })
          : !failed && <Loading />}
      </main>
      {signing && <SigningDialog signing={signing} />}
    </>
  );
}
