"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AdminReport({ data }: { data: Record<string, unknown> }) {
  const employees = (data.employees ?? []) as Array<Record<string, unknown>>;

  if (!employees.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No workforce data in report.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Workforce Report</CardTitle>
          <Badge variant="secondary">{employees.length} employees</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="text-right">Pay Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  {String(emp.first_name ?? "")} {String(emp.last_name ?? "")}
                </TableCell>
                <TableCell>{String(emp.employee_id ?? "—")}</TableCell>
                <TableCell>{String(emp.department ?? "—")}</TableCell>
                <TableCell>{String(emp.title ?? "—")}</TableCell>
                <TableCell>
                  <Badge variant={String(emp.status ?? "").toLowerCase() === "active" ? "default" : "secondary"}>
                    {String(emp.status ?? "Unknown")}
                  </Badge>
                </TableCell>
                <TableCell>{String(emp.start_date ?? "—")}</TableCell>
                <TableCell className="text-right">
                  ${Number(emp.pay_rate ?? 0).toLocaleString()}/{String(emp.pay_frequency ?? "year")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
