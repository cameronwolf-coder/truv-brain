"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function IncomeReport({ data }: { data: Record<string, unknown> }) {
  const employments = (data.employments ?? []) as Array<Record<string, unknown>>;

  if (!employments.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No employment data in report.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {employments.map((emp, i) => {
        const employer = emp.employer as Record<string, unknown> | undefined;
        const income = emp.income as Record<string, unknown> | undefined;
        const basePay = income?.base_pay as Record<string, unknown> | undefined;
        const grossPay = income?.gross_pay as Record<string, unknown> | undefined;
        const netPay = income?.net_pay as Record<string, unknown> | undefined;
        const payStatements = (emp.pay_statements ?? []) as Array<Record<string, unknown>>;

        return (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{String(employer?.name ?? "Unknown Employer")}</CardTitle>
                <Badge variant={emp.end_date ? "secondary" : "default"}>
                  {emp.end_date ? "Former" : "Current"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {String(emp.title ?? "")} &middot; {String(emp.start_date ?? "")} — {String(emp.end_date ?? "Present")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {income && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-xs text-muted-foreground">Base Pay</div>
                    <div className="text-lg font-semibold">${Number(basePay?.amount ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">/{String(basePay?.period ?? "year")}</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-xs text-muted-foreground">Gross Pay</div>
                    <div className="text-lg font-semibold">${Number(grossPay?.amount ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">/{String(grossPay?.period ?? "year")}</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <div className="text-xs text-muted-foreground">Net Pay</div>
                    <div className="text-lg font-semibold">${Number(netPay?.amount ?? 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">/{String(netPay?.period ?? "year")}</div>
                  </div>
                </div>
              )}
              {payStatements.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Recent Pay Statements</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pay Date</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payStatements.slice(0, 5).map((ps, j) => (
                        <TableRow key={j}>
                          <TableCell>{String(ps.pay_date ?? "")}</TableCell>
                          <TableCell className="text-right">${Number(ps.gross_pay ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">${Number(ps.net_pay ?? 0).toLocaleString()}</TableCell>
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
