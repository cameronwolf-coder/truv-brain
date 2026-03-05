"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BridgeState =
  | "idle"
  | "loading_token"
  | "bridge_open"
  | "exchanging"
  | "fetching_report"
  | "complete"
  | "error";

interface TruvBridgeDemoProps {
  productKey: string;
  productLabel: string;
  requiresAccountInfo?: boolean;
  onReportReceived: (report: unknown) => void;
}

export function TruvBridgeDemo({
  productKey,
  productLabel,
  requiresAccountInfo,
  onReportReceived,
}: TruvBridgeDemoProps) {
  const [state, setState] = useState<BridgeState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState({
    account_number: "",
    routing_number: "",
    bank_name: "",
  });

  const launchBridge = useCallback(async () => {
    setState("loading_token");
    setError(null);

    try {
      const tokenBody: Record<string, unknown> = { productKey };
      if (requiresAccountInfo) {
        if (!accountInfo.account_number || !accountInfo.routing_number || !accountInfo.bank_name) {
          setError("Please fill in all account fields.");
          setState("idle");
          return;
        }
        tokenBody.accountInfo = accountInfo;
      }

      const tokenRes = await fetch("/api/bridge-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
      });
      if (!tokenRes.ok) throw new Error("Failed to get bridge token");
      const { bridge_token } = await tokenRes.json();

      setState("bridge_open");

      const bridge = TruvBridge.init({
        bridgeToken: bridge_token,
        onSuccess: async (publicToken: string) => {
          setState("exchanging");
          try {
            const exchangeRes = await fetch("/api/exchange-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ public_token: publicToken }),
            });
            if (!exchangeRes.ok) throw new Error("Failed to exchange token");
            const { link_id } = await exchangeRes.json();

            setState("fetching_report");
            const reportRes = await fetch("/api/get-report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ link_id, productKey }),
            });
            if (!reportRes.ok) throw new Error("Failed to fetch report");
            const report = await reportRes.json();

            onReportReceived(report);
            setState("complete");
          } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setState("error");
          }
        },
        onClose: () => {
          if (state === "bridge_open") {
            setState("idle");
          }
        },
        onError: (err: string) => {
          setError(err);
          setState("error");
        },
      });

      bridge.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  }, [productKey, requiresAccountInfo, accountInfo, onReportReceived, state]);

  const isLoading =
    state === "loading_token" || state === "exchanging" || state === "fetching_report";

  return (
    <div className="space-y-4">
      {requiresAccountInfo && state === "idle" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h3 className="font-semibold text-sm">Account Information</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  placeholder="e.g. Chase"
                  value={accountInfo.bank_name}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({ ...prev, bank_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="routing_number">Routing Number</Label>
                <Input
                  id="routing_number"
                  placeholder="9 digits"
                  value={accountInfo.routing_number}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({ ...prev, routing_number: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  placeholder="Account number"
                  value={accountInfo.account_number}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({ ...prev, account_number: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            {state === "idle" && (
              <>
                <div className="text-4xl">🔐</div>
                <div>
                  <h3 className="font-semibold">Live {productLabel} Demo</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Click below to launch the Truv Bridge verification widget.
                  </p>
                </div>
                <Button onClick={launchBridge} size="lg" className="mt-2">
                  Launch Truv Bridge
                </Button>
                <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
                  <strong>Sandbox Credentials:</strong> Username:{" "}
                  <code className="rounded bg-background px-1 py-0.5">goodlogin</code>{" "}
                  / Password:{" "}
                  <code className="rounded bg-background px-1 py-0.5">goodpassword</code>
                </div>
              </>
            )}

            {state === "loading_token" && (
              <>
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-sm text-muted-foreground">Initializing bridge...</p>
              </>
            )}

            {state === "bridge_open" && (
              <>
                <div className="text-4xl">🔗</div>
                <p className="text-sm text-muted-foreground">
                  Truv Bridge is open — complete verification in the widget.
                </p>
              </>
            )}

            {state === "exchanging" && (
              <>
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-sm text-muted-foreground">Exchanging token...</p>
              </>
            )}

            {state === "fetching_report" && (
              <>
                <Skeleton className="h-12 w-12 rounded-full" />
                <p className="text-sm text-muted-foreground">Fetching report data...</p>
              </>
            )}

            {state === "complete" && (
              <>
                <div className="text-4xl">✅</div>
                <div>
                  <h3 className="font-semibold text-green-700">Verification Complete</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Report data displayed below.
                  </p>
                </div>
                <Button variant="outline" onClick={() => { setState("idle"); }}>
                  Run Again
                </Button>
              </>
            )}

            {state === "error" && (
              <>
                <div className="text-4xl">❌</div>
                <div>
                  <h3 className="font-semibold text-red-700">Error</h3>
                </div>
                <Button variant="outline" onClick={() => { setState("idle"); setError(null); }}>
                  Try Again
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
    </div>
  );
}
