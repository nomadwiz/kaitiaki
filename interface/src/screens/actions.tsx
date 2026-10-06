// Screen 7, Anyone's actions (`#/actions`): queue a passed proposal, carry out
// a ready one (#156). A button appears only once its date has arrived, by the
// latest block's time, which view.ts decides. Any wallet may press them
// (FR22, NFR7), so nothing here looks at the viewer. Collecting a due levy is
// the firm's alone (ADR-020), so it is on the Firm screen.
import { date } from "../format.js";
import { PageHead } from "../shell.js";
import { Waiting } from "../states.js";
import type { View } from "../view.js";

export type Act = "queue" | "execute";
// The write the wallet is signing. The firm's four and an owner's direct
// debit share the lock. A proposal being created has no number yet, and a
// collection or a direct debit names several charges, so their `id` is 0.
export type Acting = {
  action: Act | "work" | "vendor" | "confirm" | "collect" | "debit";
  id: bigint;
};
export type OnAct = (action: Act, id: bigint) => void;

function ActButton({
  action,
  id,
  label,
  onAct,
  acting,
}: {
  action: Act;
  id: bigint;
  label: string;
  onAct?: OnAct;
  acting?: Acting;
}) {
  if (!onAct) return null;
  const busy = acting !== undefined;
  const mine = acting?.action === action && acting.id === id;
  return (
    // One at a time, as Pay is.
    <button
      className="btn"
      data-size="sm"
      type="button"
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : () => onAct(action, id)}
    >
      {mine ? (
        <Waiting />
      ) : (
        label
      )}
    </button>
  );
}

export function Actions({
  actions,
  onAct,
  acting,
}: {
  actions: View["actions"];
  // Without it, no row has a button.
  onAct?: OnAct;
  // The action the wallet is signing.
  acting?: Acting;
}) {
  const button = { onAct, acting };
  return (
    <>
      <PageHead title="Anyone’s actions">
        <p className="muted-text">
          These steps need someone to press a button once their date arrives.
          Anyone may press them, owner or not. Each is signed in your wallet.
        </p>
      </PageHead>
      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Queue passed proposals</h2>
          </div>
          <div className="card-content stack">
            {actions.toQueue.length === 0 && (
              <p className="muted-text">
                No proposal is waiting to be queued.
                {actions.voting.map((v) => (
                  <span key={String(v.id)}>
                    {" "}
                    Proposal #{String(v.id)} can be queued if it passes when
                    voting closes on {date(v.closes)}.
                  </span>
                ))}
              </p>
            )}
            {actions.toQueue.map((p) => (
              <div className="row" key={String(p.id)}>
                <span className="proposal-id">#{String(p.id)}</span>
                <b>{p.title}</b>
                <span className="status" data-tone="ok">
                  Passed
                </span>
                <ActButton
                  action="queue"
                  id={p.id}
                  label="Queue"
                  {...button}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Carry out ready proposals</h2>
          </div>
          <div className="card-content stack">
            {actions.queued.length === 0 && (
              <p className="muted-text">
                No proposal is waiting to be carried out.
              </p>
            )}
            {actions.queued.map((p) => (
              <div className="stack" key={String(p.id)}>
                <div className="row">
                  <span className="proposal-id">#{String(p.id)}</span>
                  <b>{p.title}</b>
                  <span
                    className="status"
                    data-tone={p.waiting ? "wait" : "ok"}
                  >
                    {p.waiting ? "Queued" : "Ready"}
                  </span>
                  {!p.waiting && (
                    <ActButton
                      action="execute"
                      id={p.id}
                      label="Carry out"
                      {...button}
                    />
                  )}
                </div>
                {p.waiting === "date" && (
                  <p className="muted-text">
                    Available from {date(p.eta)}
                    {p.work && ", after the firm confirms the work is done"}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
