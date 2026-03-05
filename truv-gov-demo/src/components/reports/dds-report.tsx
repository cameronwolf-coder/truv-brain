"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DDSReport({ data }: { data: Record<string, unknown> }) {
  const ds = data.deposit_switch as Record<string, unknown> | undefined;

  if (!ds) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No deposit switch data in report.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Direct Deposit Switch</CardTitle>
          <Badge variant={String(ds.status ?? "").toLowerCase() === "completed" ? "default" : "secondary"}>
            {String(ds.status ?? "Unknown")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Allocation Type</div>
            <div className="text-lg font-semibold capitalize">{String(ds.allocation_type ?? "—")}</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Allocation Value</div>
            <div className="text-lg font-semibold">
              {ds.allocation_type === "percent"
                ? `${Number(ds.allocation_value ?? 0)}%`
                : `$${Number(ds.allocation_value ?? 0).toLocaleString()}`}
            </div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Account (Last 4)</div>
            <div className="text-lg font-semibold">****{String(ds.account_number_last4 ?? "—")}</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Routing Number</div>
            <div className="text-lg font-semibold">{String(ds.routing_number ?? "—")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
