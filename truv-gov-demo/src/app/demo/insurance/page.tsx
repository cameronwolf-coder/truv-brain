"use client";

import { DemoPage } from "@/components/demo-page";
import { InsuranceReport } from "@/components/reports/insurance-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "insurance")!;

export default function InsurancePage() {
  return <DemoPage useCase={useCase} reportComponent={InsuranceReport} />;
}
