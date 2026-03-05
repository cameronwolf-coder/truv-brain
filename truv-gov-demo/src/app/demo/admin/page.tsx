"use client";

import { DemoPage } from "@/components/demo-page";
import { AdminReport } from "@/components/reports/admin-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "admin")!;

export default function AdminPage() {
  return <DemoPage useCase={useCase} reportComponent={AdminReport} />;
}
