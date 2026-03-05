"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AssetsReport({ data }: { data: Record<string, unknown> }) {
  const accounts = (data.accounts ?? []) as Array<Record<string, unknown>>;

  if (!accounts.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No asset data in report.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((acct, i) => {
        const institution = acct.institution as Record<string, unknown> | undefined;
        const transactions = (acct.transactions ?? []) as Array<Record<string, unknown>>;

        return (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{String(acct.account_name ?? "Account")}</CardTitle>
                <Badge variant="secondary">{String(acct.account_type ?? "Unknown")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {String(institution?.name ?? "")} &middot; {String(acct.currency ?? "USD")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-xs text-muted-foreground">Current Balance</div>
                <div className="text-2xl font-bold">${Number(acct.balance ?? 0).toLocaleString()}</div>
              </div>
              {transactions.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Recent Transactions</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 10).map((tx, j) => (
                        <TableRow key={j}>
                          <TableCell>{String(tx.date ?? "")}</TableCell>
                          <TableCell>{String(tx.description ?? "")}</TableCell>
                          <TableCell>{String(tx.type ?? "")}</TableCell>
                          <TableCell className="text-right">${Number(tx.amount ?? 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
