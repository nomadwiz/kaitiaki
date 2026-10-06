// Screen 8's states and the Alert they use, shown wherever they arise, and
// the signing Dialog and success Toast of every transaction (#150). Markup
// copied from doc/asset/design-system/components/Screen8States, Alert,
// RefusalNotice, Dialog and Toast.
import { useEffect, useRef } from "react";

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
  variant: "default" | "success" | "destructive";
  title: string;
  description: string;
  // A contract error's name: the Alert is then a RefusalNotice.
  code?: string;
};

export function Alert({ variant, title, description, code }: Notice) {
  return (
    <div
      className="alert"
      data-variant={variant === "default" ? undefined : variant}
      role={variant === "destructive" ? "alert" : "status"}
    >
      <p className="alert-title">{title}</p>
      <p className="alert-description">{description}</p>
      {code && <p className="alert-code">Contract refusal: {code}</p>}
    </div>
  );
}

// Open only while the wallet signs. It never asks for a key or password.
export function SigningDialog({ signing }: { signing: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => dialog.current?.showModal(), []);
  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="signing-title"
      // Escape would hide it while the wallet still signs; the wallet ends it.
      onCancel={(e) => e.preventDefault()}
    >
      <p className="dialog-title" id="signing-title">
        Sign in your wallet
      </p>
      <p className="muted-text" style={{ marginTop: 8 }}>
        Your wallet is asking you to confirm {signing}.
      </p>
      <div className="dialog-footer">
        <button className="btn" type="button" aria-disabled="true">
          <Waiting />
        </button>
      </div>
    </dialog>
  );
}

export type Done = { title: string; body: string };

export function Toast({
  title,
  body,
  onDismiss,
}: Done & { onDismiss?: () => void }) {
  return (
    <div className="toast" role="status">
      <div>
        <p className="alert-title">{title}</p>
        <p className="body-sm">{body}</p>
      </div>
      <button
        className="btn"
        data-variant="ghost"
        data-size="icon"
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}

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
