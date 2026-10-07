// Activity (`#/activity`, #181), composed from doc/asset/mockups/Activity
// and FirmActivity: every event, newest first, ten a page, as EventRow's
// rows. The sentences, and which levy events stay anonymous for each role
// (NFR10), are built in view.ts; this only lays them out. The page is state,
// so it starts at 1 each time the viewer opens Activity.
import { useState } from "react";

import { RulesPopover } from "../components/kaitiaki.js";
import { Card } from "../components/ui/card.js";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination.js";
import { date } from "../format.js";
import type { Workspace } from "../shell.js";
import type { View } from "../view.js";

export const PER_PAGE = 10;

export const ACTIVITY_RULES = {
  owner: [
    "This is every event the contracts recorded, newest first.",
    "Another owner's levy events name no unit and no amount.",
  ],
  firm: [
    "This is every event the contracts recorded, newest first.",
    "Levy events name a charge, never a unit.",
  ],
} as const;

export function Activity({
  workspace,
  events,
  initialPage = 1,
}: {
  workspace: Workspace;
  events: View["activity"];
  // Only the tests start elsewhere: react-dom/server renders no press.
  initialPage?: number;
}) {
  const [page, setPage] = useState(initialPage);
  const pages = Math.ceil(events.length / PER_PAGE);
  // A link to page `n`: it changes the state, not the address.
  const to = (n: number) => ({
    href: "#/activity",
    onClick: (e: { preventDefault(): void }) => {
      e.preventDefault();
      setPage(n);
    },
  });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Activity</h1>
        <RulesPopover rules={ACTIVITY_RULES[workspace]} />
      </div>
      <Card className="gap-0 py-2 max-wide:py-2">
        {events.length === 0 ? (
          <p className="px-6 py-3.5 font-semibold max-wide:px-4">No events yet.</p>
        ) : (
          <ol aria-label="Events" className="[&>li+li]:border-t">
            {events.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((e, i) => (
              <li
                key={i}
                className="grid items-baseline gap-x-5 gap-y-1 px-6 py-3.5 text-base max-wide:px-4 max-wide:py-3 wide:grid-cols-[140px_minmax(0,1fr)_auto]"
              >
                <time className="text-muted-foreground tabular-nums">{date(e.time)}</time>
                <span>{e.text}</span>
                <span className="font-mono text-sm text-muted-foreground">{e.kind}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {pages > 1 && (
        <Pagination aria-label="Pages">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious {...(page > 1 ? to(page - 1) : { "aria-disabled": true })} />
            </PaginationItem>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <PaginationItem key={n}>
                <PaginationLink isActive={n === page} {...to(n)}>
                  {n}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext {...(page < pages ? to(page + 1) : { "aria-disabled": true })} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}
