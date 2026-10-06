// The workspace shell (ADR-021, #176): shadcn/ui's Sidebar from 800px up, the
// BottomBar below it, and a top bar naming the role. Each workspace has its
// own five items and nothing else (doc/asset/mockups/Nav.dc.html).
import {
  HandCoins,
  History,
  House,
  KeyRound,
  ScrollText,
  Store,
  Building2,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "./components/ui/sidebar.js";
import { short, unitsLabel } from "./format.js";

export type Workspace = "owner" | "firm";

export const NAV: Record<Workspace, [string, string, LucideIcon][]> = {
  owner: [
    ["#/", "Home", House],
    ["#/proposals", "Proposals", ScrollText],
    ["#/units", "Your units", KeyRound],
    ["#/building", "Building", Building2],
    ["#/activity", "Activity", History],
  ],
  firm: [
    ["#/", "Home", House],
    ["#/proposals", "Proposals", ScrollText],
    ["#/collect", "Collect levies", HandCoins],
    ["#/vendors", "Vendors", Store],
    ["#/activity", "Activity", History],
  ],
};

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
      {short(value)}
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

function Viewer({ address }: { address: string }) {
  return (
    <span className="flex items-center gap-2">
      <WalletIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="font-mono text-[0.9375rem]">{short(address)}</span>
    </span>
  );
}

export function Shell({
  workspace,
  current,
  viewer,
  units,
  children,
}: {
  workspace: Workspace;
  // The navigation link marked current.
  current: string;
  viewer: string;
  // The viewer's own units; the firm's role names none.
  units: bigint[];
  children: ReactNode;
}) {
  const items = NAV[workspace];
  const role = workspace === "firm" ? "Management firm" : "Owner";
  const holds = workspace === "owner" ? unitsLabel(units) : undefined;
  return (
    <SidebarProvider style={{ "--sidebar-width": "264px" } as object}>
      <Sidebar
        collapsible="none"
        className="sticky top-0 hidden h-svh border-r px-3 pt-5 pb-4 wide:flex"
      >
        <SidebarHeader className="px-3 pt-1 pb-4">
          <span className="text-xl font-bold tracking-tight">Kaitiaki</span>
        </SidebarHeader>
        <div className="mx-1 mb-3 grid gap-0.5 rounded-lg bg-muted px-3 py-2.5 text-base">
          <span className="font-semibold">{role}</span>
          {holds && <span className="text-muted-foreground">{holds}</span>}
        </div>
        <SidebarContent>
          <nav aria-label="Workspace">
            <SidebarMenu className="gap-0.5">
              {items.map(([href, label, Icon]) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={href === current}
                    className="text-foreground no-underline"
                  >
                    <a
                      href={href}
                      aria-current={href === current ? "page" : undefined}
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
        </SidebarContent>
        <SidebarFooter className="mt-auto gap-1 border-t px-3 pt-3.5 pb-1 text-base">
          <Viewer address={viewer} />
          <span className="text-muted-foreground">
            Every action is signed in your wallet.
          </span>
        </SidebarFooter>
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-15 items-center justify-between gap-3 border-b bg-card px-4 py-2 wide:hidden">
          <span className="grid">
            <span className="text-xl font-bold tracking-tight">Kaitiaki</span>
            <span className="text-base text-muted-foreground">
              {holds ? `${role}, ${holds}` : role}
            </span>
          </span>
          <Viewer address={viewer} />
        </header>
        <main className="flex-1 px-4 pt-5 pb-8 wide:px-12 wide:pt-10 wide:pb-16">
          <div className="flex max-w-[1200px] flex-col gap-6 wide:gap-8">
            {children}
          </div>
        </main>
        <nav
          aria-label="Workspace"
          className="sticky bottom-0 grid grid-cols-5 border-t bg-card wide:hidden"
        >
          {items.map(([href, label, Icon]) => (
            <a
              key={href}
              href={href}
              aria-current={href === current ? "page" : undefined}
              className="relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-sm leading-tight text-muted-foreground no-underline aria-[current=page]:font-semibold aria-[current=page]:text-primary aria-[current=page]:before:absolute aria-[current=page]:before:inset-x-[20%] aria-[current=page]:before:top-0 aria-[current=page]:before:h-[3px] aria-[current=page]:before:rounded-b-[3px] aria-[current=page]:before:bg-primary"
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </SidebarProvider>
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
