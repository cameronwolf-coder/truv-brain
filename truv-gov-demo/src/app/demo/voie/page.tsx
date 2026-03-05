"use client";

import { DemoPage } from "@/components/demo-page";
import { IncomeReport } from "@/components/reports/income-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "voie")!;

export default function VOIEPage() {
  return <DemoPage useCase={useCase} reportComponent={IncomeReport} />;
}
