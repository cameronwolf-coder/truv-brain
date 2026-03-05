"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function EmploymentReport({ data }: { data: Record<string, unknown> }) {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Employment History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employer</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employments.map((emp, i) => {
              const employer = emp.employer as Record<string, unknown> | undefined;
              return (
                <TableRow key={i}>
                  <TableCell className="font-medium">{String(employer?.name ?? "Unknown")}</TableCell>
                  <TableCell>{String(emp.title ?? "—")}</TableCell>
                  <TableCell>
                    <Badge variant={String(emp.status ?? "").toLowerCase() === "active" ? "default" : "secondary"}>
                      {String(emp.status ?? "Unknown")}
                    </Badge>
                  </TableCell>
                  <TableCell>{String(emp.employment_type ?? "—")}</TableCell>
                  <TableCell>{String(emp.start_date ?? "—")}</TableCell>
                  <TableCell>{String(emp.end_date ?? "Present")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
