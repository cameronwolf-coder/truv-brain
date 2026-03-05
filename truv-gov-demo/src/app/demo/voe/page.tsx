"use client";

import { DemoPage } from "@/components/demo-page";
import { EmploymentReport } from "@/components/reports/employment-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "voe")!;

export default function VOEPage() {
  return <DemoPage useCase={useCase} reportComponent={EmploymentReport} />;
}
