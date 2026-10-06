// Screen 8's states and the Alert they use, shown wherever they arise.
// Markup copied from doc/asset/design-system/components/Screen8States and
// Alert.

export type Notice = {
  variant: "default" | "success" | "destructive";
  title: string;
  description: string;
};

export function Alert({ variant, title, description }: Notice) {
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
