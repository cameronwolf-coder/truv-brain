"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TruvBridgeDemo } from "@/components/truv-bridge";
import { HowItWorks } from "@/components/how-it-works";
import { ComplianceBadges } from "@/components/compliance-badges";
import { Card, CardContent } from "@/components/ui/card";
import type { UseCase } from "@/lib/use-cases";

interface DemoPageProps {
  useCase: UseCase;
  requiresAccountInfo?: boolean;
  reportComponent: React.ComponentType<{ data: Record<string, unknown> }>;
}

export function DemoPage({ useCase, requiresAccountInfo, reportComponent: ReportComponent }: DemoPageProps) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{useCase.icon}</span>
          <h1 className="text-2xl font-bold tracking-tight">{useCase.name}</h1>
        </div>
        <p className="text-muted-foreground">{useCase.govDescription}</p>
        <div className="mt-3">
          <ComplianceBadges badges={useCase.complianceBadges} />
        </div>
      </div>

      <Tabs defaultValue="demo" className="space-y-6">
        <TabsList>
          <TabsTrigger value="demo">Live Demo</TabsTrigger>
          <TabsTrigger value="how">How It Works</TabsTrigger>
          <TabsTrigger value="uses">Gov Use Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="demo" className="space-y-6">
          <TruvBridgeDemo
            productKey={useCase.key}
            productLabel={useCase.name}
            requiresAccountInfo={requiresAccountInfo}
            onReportReceived={(data) => setReport(data as Record<string, unknown>)}
          />
          {report && <ReportComponent data={report} />}
        </TabsContent>

        <TabsContent value="how">
          <HowItWorks steps={useCase.howItWorks} />
        </TabsContent>

        <TabsContent value="uses">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 font-semibold">Government Use Cases</h3>
              <ul className="space-y-3">
                {useCase.govUseCases.map((uc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>{uc}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
