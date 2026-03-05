"use client";

import { DemoPage } from "@/components/demo-page";
import { DDSReport } from "@/components/reports/dds-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "dds")!;

export default function DDSPage() {
  return <DemoPage useCase={useCase} requiresAccountInfo reportComponent={DDSReport} />;
}
