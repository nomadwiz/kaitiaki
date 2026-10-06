// The interface's markup (#149): the design system's AppShell and the seven
// screens, as React components that keep every class name and attribute of
// the design system's previews (doc/asset/design-system/components/). Each is
// a pure function of its props, so test/interface.ts renders them with
// react-dom/server and checks exactly what a viewer would see.
//
// Every arrears status of a unit other than the viewer's own sits in
// OtherUnitRow's markup, `<li data-other-unit>` with the status in an element
// whose last attribute is `data-arrears`, and its row says nothing else beyond
// the unit's name. The NFR10 test reads those rows for digits.
import { formatUnits } from "ethers";
import { Fragment, useRef, useState, type FormEvent } from "react";

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

export type Notice = {
  variant: "default" | "success" | "destructive";
  title: string;
  description: string;
};

type Props = {
  hash: string;
  // Undefined while the event log is being read.
  view?: View;
  wallet?: Wallet;
  notice?: Notice;
  // The proposal whose vote the wallet is signing.
  voting?: bigint;
  onConnect?: () => void;
  onViewer?: (address: string) => void;
  onVote?: (proposalId: bigint, inFavour: boolean) => void;
};

const NAV = [
  ["#/", "Home"],
  ["#/units", "Your units"],
  ["#/register", "Register"],
  ["#/activity", "Activity"],
  ["#/actions", "Actions"],
  ["#/firm", "Firm"],
];

const TONE = {
  Open: "info",
  Extended: "wait",
  Passed: "ok",
  Failed: "fail",
  Queued: "wait",
  Executed: "done",
} as const;

const FUNDS = [
  ["op", "Operating", "Running costs: cleaning, power, insurance."],
  ["ltm", "Long-term maintenance", "Roof, lifts, cladding. Saved over years."],
] as const;

const DATE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Pacific/Auckland",
});

// Amounts are 18-decimal token units: `NZD 48,000.00`.
const nzd = (amount: bigint) =>
  `NZD ${Number(formatUnits(amount, 18)).toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const date = (timestamp: bigint) =>
  DATE.format(new Date(Number(timestamp) * 1000));

// "Unit 3", "Units 1 and 2".
const unitsLabel = (units: bigint[]) =>
  units.length === 0
    ? "No unit"
    : `Unit${units.length > 1 ? "s" : ""} ${new Intl.ListFormat("en-NZ").format(units.map(String))}`;

function Address({ value }: { value: string }) {
  return (
    <span className="addr">
      {`${value.slice(0, 6)}…${value.slice(-4)}`}
      <button
        className="btn"
        type="button"
        aria-label="Copy address"
        onClick={() => void navigator.clipboard?.writeText(value)}
      >
        Copy
      </button>
    </span>
  );
}

function WalletSlot({ view, wallet, onConnect, onViewer }: Props) {
  // A browser wallet's account is known before the log has been read.
  const viewer = wallet?.kind === "browser" ? wallet.account : view?.viewer;
  if (wallet?.kind === "browser" && !viewer) {
    return (
      <span className="wallet-slot">
        {wallet.chainId === wallet.deploymentChainId && (
          <button className="btn" type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </span>
    );
  }
  if (!viewer) return <span className="wallet-slot" />;
  return (
    <span className="wallet-slot">
      <span className="wallet">
        <span className="wallet-dot" aria-hidden="true"></span>
        <span>
          {wallet?.kind === "node" ? (
            <>
              <label className="sr-only" htmlFor="viewer">
                Viewing as
              </label>
              <select
                id="viewer"
                className="select"
                value={viewer}
                onChange={(e) => onViewer?.(e.target.value)}
              >
                {wallet.choices.map((c) => (
                  <option key={c.address} value={c.address}>
                    {unitsLabel(c.units)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            view && <b>{unitsLabel(view.ownUnits.map((u) => u.unitId))}</b>
          )}
          <br />
          <Address value={viewer} />
        </span>
      </span>
    </span>
  );
}

function AppShell({ current, ...props }: Props & { current: string }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    menu.current?.focus();
  };
  return (
    <header className="shell-header">
      <div className="shell-bar">
        <a className="wordmark" href="#/">
          Kaitiaki<small>Body corporate treasury</small>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={href === current ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <WalletSlot {...props} />
        <button
          ref={menu}
          className="btn nav-toggle"
          data-variant="outline"
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sheet"
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>
      {open && (
        <nav
          className="sheet"
          id="sheet"
          aria-label="Main"
          onKeyDown={(e) => e.key === "Escape" && close()}
        >
          <button
            className="btn"
            data-variant="outline"
            type="button"
            autoFocus
            onClick={close}
          >
            Close menu
          </button>
          {NAV.map(([href, label]) => (
            <a
              key={href}
              className="btn"
              data-variant="ghost"
              href={href}
              style={{ justifyContent: "flex-start" }}
              aria-current={href === current ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function PageHead({ title }: { title: string }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
    </div>
  );
}

function Loading() {
  return (
    <section className="card" aria-busy="true">
      <div
        className="card-content stack"
        style={{ paddingTop: "var(--space-6)" }}
      >
        <p role="status" className="row">
          <span
            className="btn"
            data-variant="ghost"
            style={{ padding: 0, minHeight: 0 }}
          >
            <span className="spinner" aria-hidden="true"></span>
          </span>
          Reading the event log…
        </p>
        <span className="skeleton" style={{ height: 28, width: "60%" }}></span>
        <span className="skeleton" style={{ height: 48 }}></span>
        <span className="skeleton" style={{ height: 48, width: "80%" }}></span>
      </div>
    </section>
  );
}

function Alert({ variant, title, description }: Notice) {
  return (
    <div
      className="alert"
      data-variant={variant === "default" ? undefined : variant}
      role={variant === "destructive" ? "alert" : "status"}
    >
      <p className="alert-title">{title}</p>
      <p className="alert-description">{description}</p>
    </div>
  );
}

// Screen 8: a browser wallet not yet connected, or a wallet holding no unit.
function WalletState({ view, wallet, onConnect }: Props) {
  if (wallet?.kind === "browser" && !view!.viewer) {
    if (wallet.chainId !== wallet.deploymentChainId) return null;
    return (
      <section className="card">
        <div className="card-header">
          <h3 className="card-title">Connect your wallet to vote or pay</h3>
          <p className="card-description">
            You can read everything without one.
          </p>
        </div>
        <div className="card-content stack">
          <button className="btn" type="button" onClick={onConnect}>
            Connect wallet
          </button>
          <p className="field-hint">
            Kaitiaki never asks for a private key, seed phrase or password. Your
            wallet signs each action.
          </p>
        </div>
      </section>
    );
  }
  if (view!.viewer && view!.ownUnits.length === 0) {
    return (
      <Alert
        variant="default"
        title="This wallet holds no unit in this building, so it cannot vote."
        description="You can still read the whole record, and pay a levy charge for any unit."
      />
    );
  }
  return null;
}

function VoteControl({
  proposal: p,
  voting,
  onVote,
}: {
  proposal: View["proposals"][number];
  voting?: bigint;
  onVote?: Props["onVote"];
}) {
  const n = p.unvoted.length;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const button = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement;
    onVote?.(p.id, button.value === "true");
  };
  return (
    <form className="vote" data-proposal={String(p.id)} onSubmit={submit}>
      <p className="vote-units">
        You hold <b>{n === 1 ? "1 unit" : `${n} units`}</b> that{" "}
        {n === 1 ? "has" : "have"} not voted:{" "}
        {p.unvoted.map((u) => `Unit ${u}`).join(", ")}.
        {n === 2 ? " Both vote together." : n > 2 ? " All vote together." : ""}
      </p>
      <div className="vote-buttons">
        {voting === p.id ? (
          <>
            <button className="btn" type="button" aria-disabled="true">
              <span className="spinner" aria-hidden="true"></span>Waiting for
              your wallet…
            </button>
            <button
              className="btn"
              data-variant="outline"
              type="button"
              aria-disabled="true"
            >
              Vote against
            </button>
          </>
        ) : (
          <>
            <button className="btn" type="submit" name="inFavour" value="true">
              Vote for
            </button>
            <button
              className="btn"
              data-variant="outline"
              type="submit"
              name="inFavour"
              value="false"
            >
              Vote against
            </button>
          </>
        )}
      </div>
      <p className="field-hint">
        Your wallet will ask you to sign. Kaitiaki never sees your key.
      </p>
    </form>
  );
}

function ProposalCard({
  proposal: p,
  canAct,
  ...props
}: Props & { proposal: View["proposals"][number]; canAct: boolean }) {
  const work = p.kind === "Work";
  return (
    <article className="card proposal">
      <div className="proposal-top">
        <span className="proposal-id">#{String(p.id)}</span>
        <span className="badge" data-variant="secondary">
          {work ? "Work" : "Admit vendor"}
        </span>
        <span className="status" data-tone={TONE[p.state]}>
          {p.state}
        </span>
      </div>
      <h3 className="proposal-title">
        <a href={`#/proposal/${p.id}`}>
          {work ? p.description : `Admit ${p.description}`}
        </a>
      </h3>
      <dl className="meta">
        {work ? (
          <>
            <div>
              <dt>Spending cap</dt>
              <dd>{nzd(p.limit)}</dd>
            </div>
            <div>
              <dt>Pays from</dt>
              <dd>
                <span className="fund-tag" data-fund={FUNDS[Number(p.fund)][0]}>
                  {FUNDS[Number(p.fund)][1]}
                </span>
              </dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                <Address value={p.payee} />
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Adds vendor</dt>
              <dd>{p.description}</dd>
            </div>
            <div>
              <dt>Vendor wallet</dt>
              <dd>
                <Address value={p.payee} />
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="next">
        <span>
          {String(p.forVotes)} for · {String(p.againstVotes)} against
        </span>
      </div>
      {p.canVote && canAct && (
        <VoteControl proposal={p} voting={props.voting} onVote={props.onVote} />
      )}
    </article>
  );
}

function Home(props: Props & { view: View; canAct: boolean }) {
  const { view } = props;
  const balances = [view.funds.operating, view.funds.maintenance];
  return (
    <>
      <PageHead title="Home" />
      <WalletState {...props} />
      <section aria-labelledby="h-funds">
        <div className="section-head">
          <h2 id="h-funds">The building’s money</h2>
          <span className="muted-text">Two funds. They never mix.</span>
        </div>
        <div className="grid-2">
          {FUNDS.map(([fund, name, description], i) => (
            <section
              key={fund}
              className="card fund"
              data-fund={fund}
              aria-label={`${name} fund`}
            >
              <div className="card-header">
                <h3 className="card-title">{name}</h3>
                <p className="card-description">{description}</p>
              </div>
              <div className="card-content">
                <p className="fund-balance">{nzd(balances[i])}</p>
              </div>
            </section>
          ))}
        </div>
      </section>
      <section aria-labelledby="h-proposals">
        <div className="section-head">
          <h2 id="h-proposals">Proposals</h2>
        </div>
        {view.proposals.length ? (
          <div className="grid-2">
            {view.proposals.map((p) => (
              <ProposalCard key={String(p.id)} {...props} proposal={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No proposals yet</h3>
            <p>
              The management firm proposes work and vendors. Owners then vote.
              New proposals will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function YourUnits(props: Props & { view: View }) {
  const { view } = props;
  return (
    <>
      <PageHead title="Your units and levies" />
      <WalletState {...props} />
      {view.ownUnits.length > 0 && (
        <div className="card">
          <div
            className="card-content stack"
            style={{ paddingTop: "var(--space-6)" }}
          >
            {view.ownUnits.map((u, i) => (
              <Fragment key={String(u.unitId)}>
                {i > 0 && <hr className="separator" />}
                <div className="own-unit">
                  <div className="row">
                    <h3 className="card-title">Unit {String(u.unitId)}</h3>
                    <span
                      className="status"
                      data-tone={u.status === "current" ? "ok" : "late"}
                    >
                      {u.status}
                    </span>
                  </div>
                  {u.overdue.length === 0 && (
                    <p className="muted-text">No overdue charges.</p>
                  )}
                  {u.overdue.map((c) => (
                    <div key={String(c.chargeId)} className="charge">
                      <div>
                        <p className="charge-amount">{nzd(c.amount)}</p>
                        <p
                          className="field-hint"
                          style={{ color: "var(--foreground)" }}
                        >
                          Charge #{String(c.chargeId)} · was due{" "}
                          {date(c.dueDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Register({ view }: { view: View }) {
  return (
    <>
      <PageHead title="Building register" />
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
            {view.otherUnits.map((u) => (
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
    </>
  );
}

const TITLES: Record<string, string> = {
  "#/activity": "Activity",
  "#/actions": "Anyone’s actions",
  "#/firm": "Firm workspace",
};

export function App(props: Props) {
  const { hash, view, wallet, notice } = props;
  const proposal = /^#\/proposal\/(\d+)$/.exec(hash)?.[1];
  const known = proposal || NAV.some(([href]) => href === hash);
  const route = known && !proposal ? hash : "#/";
  // A wallet on another chain than the deployment's is offered no action.
  const wrongChain =
    wallet?.kind === "browser" && wallet.chainId !== wallet.deploymentChainId;
  const canAct = !wrongChain;

  let screen;
  if (!view) screen = <Loading />;
  else if (proposal) screen = <PageHead title={`Proposal #${proposal}`} />;
  else if (route === "#/units") screen = <YourUnits {...props} view={view} />;
  else if (route === "#/register") screen = <Register view={view} />;
  else if (route in TITLES) screen = <PageHead title={TITLES[route]} />;
  else screen = <Home {...props} view={view} canAct={canAct} />;

  return (
    <>
      <AppShell {...props} current={route} />
      <main className="shell-main">
        {wrongChain && (
          <Alert
            variant="destructive"
            title={`Your wallet is on chain ${wallet.chainId}, and Kaitiaki is deployed on chain ${wallet.deploymentChainId}.`}
            description={`Switch your wallet to chain ${wallet.deploymentChainId}. Nothing can be signed until then.`}
          />
        )}
        {notice && <Alert {...notice} />}
        {screen}
      </main>
    </>
  );
}
