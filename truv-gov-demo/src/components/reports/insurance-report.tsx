"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function InsuranceReport({ data }: { data: Record<string, unknown> }) {
  const policies = (data.policies ?? []) as Array<Record<string, unknown>>;

  if (!policies.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No insurance data in report.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {policies.map((policy, i) => {
        const coverages = (policy.coverage ?? []) as Array<Record<string, unknown>>;

        return (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{String(policy.carrier ?? "Unknown Carrier")}</CardTitle>
                <Badge variant={String(policy.status ?? "").toLowerCase() === "active" ? "default" : "secondary"}>
                  {String(policy.status ?? "Unknown")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Policy #{String(policy.policy_number ?? "—")} &middot; {String(policy.type ?? "")}
              </p>
              <p className="text-xs text-muted-foreground">
                {String(policy.effective_date ?? "")} — {String(policy.expiration_date ?? "")}
              </p>
            </CardHeader>
            {coverages.length > 0 && (
              <CardContent>
                <h4 className="mb-2 text-sm font-medium">Coverage Details</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Limit</TableHead>
                      <TableHead className="text-right">Deductible</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverages.map((cov, j) => (
                      <TableRow key={j}>
                        <TableCell>{String(cov.type ?? "")}</TableCell>
                        <TableCell className="text-right">${Number(cov.limit ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">${Number(cov.deductible ?? 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
