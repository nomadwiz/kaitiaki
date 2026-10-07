// The entry screens (ADR-021, #186): Connect, for a viewer with no wallet
// connected, and No unit, for a wallet that holds no unit and is not the
// firm's. One centred Card with no navigation and no building data
// (doc/asset/mockups/Connect.dc.html, its `state` nounit, and their Mobile
// pages). The building's name under the wordmark has no source
// (interface.md §5).
import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import { Card, CardContent, CardHeader } from "../components/ui/card.js";

export function Entry({
  viewer,
  onConnect,
  children,
}: {
  // The connected address, which holds no unit; undefined for Connect.
  viewer?: string;
  // Given only when the wallet can be asked to connect.
  onConnect?: () => void;
  // The Alerts for a wrong network or a failed connection.
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 wide:p-12">
      <Card className="w-full max-w-[520px] gap-6 py-8 max-wide:gap-6 max-wide:py-8">
        <CardHeader>
          <span className="text-xl font-bold tracking-tight">Kaitiaki</span>
        </CardHeader>
        <CardContent className="grid gap-3">
          <h1 className="text-[1.75rem]">
            {viewer
              ? "This wallet holds no unit in this building"
              : "Connect your wallet"}
          </h1>
          {viewer && <p>If you own a unit here, switch to the wallet bound to it.</p>}
        </CardContent>
        <CardContent className="grid gap-3">
          {children}
          {viewer && (
            <Alert role="status">
              <Wallet aria-hidden="true" />
              <AlertTitle>Connected</AlertTitle>
              <AlertDescription className="font-mono text-[0.9375rem] text-foreground [overflow-wrap:anywhere]">
                {viewer}
              </AlertDescription>
            </Alert>
          )}
          {onConnect && (
            <>
              <Button size="lg" className="w-full" onClick={onConnect}>
                <Wallet aria-hidden="true" />
                Connect wallet
              </Button>
              <p className="text-base text-muted-foreground">
                Your wallet signs every action. Kaitiaki never asks for a key,
                seed phrase or password.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
