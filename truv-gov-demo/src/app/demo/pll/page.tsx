"use client";

import { DemoPage } from "@/components/demo-page";
import { PLLReport } from "@/components/reports/pll-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "pll")!;

export default function PLLPage() {
  return <DemoPage useCase={useCase} requiresAccountInfo reportComponent={PLLReport} />;
}
