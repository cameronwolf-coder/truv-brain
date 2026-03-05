"use client";

import { DemoPage } from "@/components/demo-page";
import { AssetsReport } from "@/components/reports/assets-report";
import { USE_CASES } from "@/lib/use-cases";

const useCase = USE_CASES.find((uc) => uc.key === "voa")!;

export default function VOAPage() {
  return <DemoPage useCase={useCase} reportComponent={AssetsReport} />;
}
