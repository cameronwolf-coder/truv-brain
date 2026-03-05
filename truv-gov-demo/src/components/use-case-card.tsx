import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UseCase } from "@/lib/use-cases";

export function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <Card className="group relative flex flex-col transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xl">
            {useCase.icon}
          </div>
          <div>
            <CardTitle className="text-base">{useCase.name}</CardTitle>
            <span className="text-xs font-medium text-muted-foreground">
              {useCase.shortName}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
          {useCase.govDescription}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {useCase.complianceBadges.map((badge) => (
            <Badge key={badge} variant="secondary" className="text-[10px] font-medium">
              {badge}
            </Badge>
          ))}
        </div>
        <Button asChild className="mt-4 w-full" variant="outline">
          <Link href={`/demo/${useCase.key}`}>Try Live Demo</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
