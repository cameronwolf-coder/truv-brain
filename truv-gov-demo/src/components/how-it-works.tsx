import { Card, CardContent } from "@/components/ui/card";

interface Step {
  step: number;
  title: string;
  description: string;
}

export function HowItWorks({ steps }: { steps: Step[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map((s) => (
        <Card key={s.step}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {s.step}
              </div>
              <h3 className="font-semibold text-sm">{s.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
