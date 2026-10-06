// Screen 8's states (#150, #189): an outcome that needs nothing more is a
// Sonner toast, fired by main.tsx; a condition that stays until the viewer
// acts is shadcn/ui's Alert; shadcn/ui's Dialog only while a wallet signs.
// Words from doc/asset/design-system/README.md's States, RefusalNotice and
// the States mock-up.
import { CircleAlert, LoaderCircle, TriangleAlert, Wallet } from "lucide-react";
import { useState } from "react";

import {
  AlertDescription,
  AlertTitle,
  Alert as Callout,
} from "./components/ui/alert.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "./components/ui/dialog.js";

// What a button shows while the viewer's wallet signs.
export function Waiting() {
  return (
    <>
      <span className="spinner" aria-hidden="true"></span>
      Waiting for your wallet…
    </>
  );
}

export type Notice = {
  variant: "default" | "warning" | "destructive";
  title: string;
  description: string;
  // A contract error's name: the Alert is then a RefusalNotice.
  code?: string;
};

const ICON = { warning: TriangleAlert, destructive: CircleAlert };

export function Alert({ variant, title, description, code }: Notice) {
  const Icon = variant === "default" ? undefined : ICON[variant];
  return (
    <Callout variant={variant} role={variant === "default" ? "status" : "alert"}>
      {Icon && <Icon aria-hidden="true" />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {description}
        {code && <p className="font-mono text-sm">{code}</p>}
      </AlertDescription>
    </Callout>
  );
}

// Open while the wallet signs, unless the viewer closes it: closing hides
// only this Dialog, and the wallet's own request stays until it is answered.
// It never asks for a key or password.
export function SigningDialog({ signing }: { signing: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle className="flex items-center gap-2.5">
          <Wallet aria-hidden="true" className="size-6 text-primary" />
          Confirm in your wallet
        </DialogTitle>
        <DialogDescription>
          Your wallet is asking you to confirm {signing}.
        </DialogDescription>
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Waiting for your wallet
        </p>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// A Sonner toast's words: a transaction recorded, with what it did, or a
// request cancelled in the wallet, which needs only its one line.
export type Done = { title: string; body?: string; cancelled?: true };

export function Loading() {
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

export function ConnectWallet({ onConnect }: { onConnect?: () => void }) {
  return (
    <section className="card">
      <div className="card-header">
        <h3 className="card-title">Connect your wallet to vote or pay</h3>
        <p className="card-description">You can read everything without one.</p>
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

export function NoUnit() {
  return (
    <Alert
      variant="default"
      title="This wallet holds no unit in this building, so it cannot vote."
      description="You can still read the whole record, and pay a levy charge for any unit."
    />
  );
}
