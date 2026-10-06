// The design system's AppShell: header bar, main navigation (a Sheet behind
// Menu below 800px) and the wallet slot. Markup copied from
// doc/asset/design-system/components/AppShell and Sheet.
import { useRef, useState, type ReactNode } from "react";

import { unitsLabel } from "./format.js";

export const NAV = [
  ["#/", "Home"],
  ["#/units", "Your units"],
  ["#/register", "Register"],
  ["#/activity", "Activity"],
  ["#/actions", "Actions"],
  ["#/firm", "Firm"],
];

// A value shortened to its ends, with a button that copies all of it.
export function Address({
  value,
  label = "Copy address",
}: {
  value: string;
  label?: string;
}) {
  return (
    <span className="addr">
      {`${value.slice(0, 6)}…${value.slice(-4)}`}
      <button
        className="btn"
        type="button"
        aria-label={label}
        // A refused clipboard leaves the address on screen; nothing is lost.
        onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}
      >
        Copy
      </button>
    </span>
  );
}

// The viewer's units and shortened address, or Connect wallet. With the local
// node's accounts (`choices`), a select picks the viewer.
export function WalletSlot({
  viewer,
  units,
  choices,
  canConnect,
  onConnect,
  onViewer,
}: {
  viewer?: string;
  // Undefined until the log has been read.
  units?: bigint[];
  choices?: { address: string; units: bigint[] }[];
  // A browser wallet, not connected, on the deployment's chain.
  canConnect?: boolean;
  onConnect?: () => void;
  onViewer?: (address: string) => void;
}) {
  if (!viewer) {
    return (
      <span className="wallet-slot">
        {canConnect && (
          <button className="btn" type="button" onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </span>
    );
  }
  return (
    <span className="wallet-slot">
      <span className="wallet">
        <span className="wallet-dot" aria-hidden="true"></span>
        <span>
          {choices ? (
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
                {choices.map((c) => (
                  <option key={c.address} value={c.address}>
                    {unitsLabel(c.units)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            units && <b>{unitsLabel(units)}</b>
          )}
          <br />
          <Address value={viewer} />
        </span>
      </span>
    </span>
  );
}

export function AppShell({
  current,
  wallet,
}: {
  // The navigation link marked current.
  current: string;
  wallet: ReactNode;
}) {
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
        {wallet}
        <button
          ref={menu}
          className="btn nav-toggle"
          data-variant="outline"
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls={open ? "sheet" : undefined}
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>
      {open && (
        <nav
          className="sheet"
          id="sheet"
          aria-label="Menu"
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

export function PageHead({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {children}
    </div>
  );
}
