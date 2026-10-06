// The components only Kaitiaki has (doc/asset/design-system/components/),
// built on shadcn/ui's. Each screen rebuilt from its mock-up takes them from
// here.
import { Check, Copy, Info } from "lucide-react";

import { date, short } from "../format.js";
import { cn } from "../lib/utils.js";
import type { Step } from "../view.js";
import type { QuorumParts } from "../../../scripts/replay.js";
import { Button } from "./ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";
import { Progress } from "./ui/progress.js";

// StatusBadge: the word is the element's only text; index.css draws the
// shape beside it from `data-tone`, so status is never colour alone.
export const TONE = {
  Open: "info",
  Extended: "wait",
  Passed: "ok",
  Failed: "fail",
  Queued: "wait",
  Executed: "done",
  current: "ok",
  "in arrears": "late",
  met: "ok",
  "not yet met": "wait",
} as const;

export function StatusBadge({ word }: { word: keyof typeof TONE }) {
  return (
    <span
      className="status inline-flex items-center gap-1.5 rounded-sm border-0 px-2.5 py-px text-base font-semibold whitespace-nowrap"
      data-tone={TONE[word]}
    >
      {word}
    </span>
  );
}

// A fund always shows its name beside its marker: a square for Operating, a
// disc for Long-term maintenance.
export const FUND_NAMES = ["Operating", "Long-term maintenance"] as const;

export function Fund({ fund }: { fund: bigint }) {
  const operating = fund === 0n;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 flex-none bg-current",
          operating ? "rounded-[1px] text-fund-operating" : "rounded-full text-fund-ltm",
        )}
      />
      <span className="text-foreground">{FUND_NAMES[operating ? 0 : 1]}</span>
    </span>
  );
}

// RulesPopover: the rules a viewer needs before acting on a card, behind a
// "Rules" button in its header. Radix gives the trigger `aria-expanded` and
// closes the panel on Escape or a press outside.
export function RulesPopover({ rules }: { rules: readonly string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="px-2.5 text-muted-foreground">
          <Info aria-hidden="true" />
          Rules
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Rules" className="leading-normal">
        <ul className="grid list-disc gap-2 pl-[18px]">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// QuorumMeter: both conditions Governance.quorumReached checks, each as its
// count, a met or not-yet-met StatusBadge and a Progress bar.
export function QuorumMeter({ quorum: q }: { quorum: QuorumParts }) {
  const rows = [
    ["Units voted (25% of the building)", q.unitsVoted, q.unitsNeeded, "units", q.unitsMet],
    ["Different owners voted", q.voters, q.votersNeeded, "owners", q.votersMet],
  ] as const;
  return (
    <div className="flex flex-col gap-3">
      {rows.map(([label, count, of, unit, met]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-base">
            <span>{label}</span>
            <span className="flex items-center gap-2">
              <span>
                <b className="tabular-nums">
                  {String(count)} of {String(of)}
                </b>{" "}
                {unit}
              </span>
              <StatusBadge word={met ? "met" : "not yet met"} />
            </span>
          </span>
          <Progress
            aria-label={label}
            value={Number(of) ? Math.min(100, (Number(count) * 100) / Number(of)) : 0}
          />
        </div>
      ))}
    </div>
  );
}

// Address: an address or hash shortened to its ends, in mono, and a Copy
// button that copies all of it. `label` names what is copied.
export function Address({
  value,
  label = "Copy address",
}: {
  value: string;
  label?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <span className="font-mono text-[0.9375rem]">{short(value)}</span>
      <Button
        variant="ghost"
        className="px-2.5"
        aria-label={label}
        // A refused clipboard leaves the value on screen; nothing is lost.
        onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}
      >
        <Copy aria-hidden="true" className="size-4" />
        Copy
      </Button>
    </span>
  );
}

// LifecycleTimeline: a proposal's steps in the contract's order, as view.ts
// gives them, each with its date. Horizontal from 800px, vertical below. A
// done step's marker is solid with a tick, the current one ringed in the
// primary colour, a skipped one dashed.
export function LifecycleTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol
      aria-label="Proposal lifecycle"
      className="grid wide:auto-cols-fr wide:grid-flow-col"
    >
      {steps.map((s) => (
        <li
          key={s.name}
          data-step={s.step}
          aria-current={s.step === "current" ? "step" : undefined}
          className="group relative min-h-12 pb-5 pl-10 last:pb-0 wide:pt-[34px] wide:pr-3 wide:pb-0 wide:pl-0"
        >
          <span
            aria-hidden="true"
            className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-border group-last:hidden group-data-[step=done]:bg-primary wide:top-[11px] wide:right-0 wide:bottom-auto wide:left-0 wide:h-0.5 wide:w-auto wide:group-data-[step=current]:bg-[linear-gradient(to_right,var(--primary)_50%,var(--border)_50%)]"
          />
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 grid size-6 place-items-center rounded-full border-2 border-input bg-card text-primary-foreground group-data-[step=current]:border-primary group-data-[step=current]:shadow-[0_0_0_5px_var(--accent)] group-data-[step=done]:border-primary group-data-[step=done]:bg-primary group-data-[step=skipped]:border-dashed"
          >
            {s.step === "done" && <Check className="size-4" />}
            {s.step === "current" && (
              <span className="size-2.5 rounded-full bg-primary" />
            )}
          </span>
          <span className="block font-semibold group-data-[step=current]:text-primary group-data-[step=skipped]:font-medium group-data-[step=skipped]:text-muted-foreground group-data-[step=todo]:font-medium group-data-[step=todo]:text-muted-foreground">
            {s.name}
          </span>
          {(s.date !== undefined || s.step === "current") && (
            <span className="block text-base text-muted-foreground tabular-nums">
              {s.date === undefined
                ? "Now"
                : `${s.dateLabel ? `${s.dateLabel} ` : ""}${date(s.date)}`}
            </span>
          )}
          {s.name === "Extended" && s.step === "current" && (
            <span className="block text-base font-semibold text-warning">
              Quorum waived. One owner's vote can decide.
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
