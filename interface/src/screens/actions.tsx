// Screen 7, Anyone's actions (`#/actions`): issue a due charge, queue a passed
// proposal, carry out a ready one (#156). A button appears only once its date
// has arrived, by the latest block's time, which view.ts decides. Any wallet
// may press them (FR6, NFR7), so nothing here looks at the viewer.
import { date } from "../format.js";
import { PageHead } from "../shell.js";
import type { View } from "../view.js";

export type Act = "issue" | "queue" | "execute";
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
  acting?: { action: Act; id: bigint };
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
        <>
          <span className="spinner" aria-hidden="true"></span>
          Waiting for your wallet…
        </>
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
  acting?: { action: Act; id: bigint };
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
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Issue due charges</h2>
          <p className="card-description">
            Turns a scheduled levy charge into one that is owed. Charges are
            listed without their unit.
          </p>
        </div>
        <div className="card-content" style={{ overflowX: "auto" }}>
          {actions.charges.length === 0 ? (
            <p className="muted-text">No charge is waiting to be issued.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Charge</th>
                  <th>Can be issued from</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {actions.charges.map((c) => (
                  <tr key={String(c.chargeId)}>
                    <td>Charge #{String(c.chargeId)}</td>
                    <td>{date(c.dueDate)}</td>
                    {c.due ? (
                      <td className="num">
                        <ActButton
                          action="issue"
                          id={c.chargeId}
                          label="Issue charge"
                          {...button}
                        />
                      </td>
                    ) : (
                      <td className="num muted-text">
                        Available from {date(c.dueDate)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
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
