// The components only Kaitiaki has (doc/asset/design-system/components/),
// built on shadcn/ui's. Each screen rebuilt from its mock-up takes them from
// here.
import { Info } from "lucide-react";

import { cn } from "../lib/utils.js";
import { Button } from "./ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

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
