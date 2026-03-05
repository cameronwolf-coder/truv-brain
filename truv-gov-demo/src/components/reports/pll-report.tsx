"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PLLReport({ data }: { data: Record<string, unknown> }) {
  const pll = data.paycheck_linked_lending as Record<string, unknown> | undefined;

  if (!pll) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No paycheck linked lending data in report.
        </CardContent>
      </Card>
    );
  }

  const employer = pll.employer as Record<string, unknown> | undefined;
  const allocation = pll.allocation as Record<string, unknown> | undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Paycheck Linked Lending</CardTitle>
          <Badge variant={String(pll.status ?? "").toLowerCase() === "active" ? "default" : "secondary"}>
            {String(pll.status ?? "Unknown")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Employer</div>
            <div className="text-lg font-semibold">{String(employer?.name ?? "—")}</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Pay Frequency</div>
            <div className="text-lg font-semibold capitalize">{String(pll.pay_frequency ?? "—")}</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Next Pay Date</div>
            <div className="text-lg font-semibold">{String(pll.next_pay_date ?? "—")}</div>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <div className="text-xs text-muted-foreground">Allocation</div>
            <div className="text-lg font-semibold">
              {allocation?.type === "percent"
                ? `${Number(allocation?.value ?? 0)}%`
                : `$${Number(allocation?.value ?? 0).toLocaleString()}`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
