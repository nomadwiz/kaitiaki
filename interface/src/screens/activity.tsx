// Screen 5, Activity (`#/activity`): every event, newest first, as EventRow's
// markup. The sentences, and which levy events stay anonymous (NFR10), are
// built in view.ts; this only lays them out.
import { date } from "../format.js";
import { PageHead } from "../shell.js";
import { Alert } from "../states.js";
import type { View } from "../view.js";

export function Activity({ events }: { events: View["activity"] }) {
  return (
    <>
      <PageHead title="Activity">
        <p className="muted-text">
          Every event the building’s contracts have recorded, newest first.
        </p>
      </PageHead>
      <Alert
        variant="default"
        title="Every figure on this site is recalculated from this list."
        description="Kaitiaki stores nothing of its own. It reads these public events and adds them up. Anyone can do the same from their own copy of the chain."
      />
      <section className="card">
        <div className="card-content" style={{ paddingTop: "var(--space-3)" }}>
          {events.length === 0 ? (
            <p className="muted-text">No events yet.</p>
          ) : (
            <ol className="events" reversed>
              {events.map((e, i) => (
                <li key={i} className="event">
                  <time>{date(e.time)}</time>
                  <span className="event-text">{e.text}</span>
                  <span className="event-kind">{e.kind}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  );
}
