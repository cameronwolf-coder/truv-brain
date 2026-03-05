import { Badge } from "@/components/ui/badge";

export function ComplianceBadges({ badges }: { badges: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Badge key={badge} variant="secondary" className="text-xs">
          {badge}
        </Badge>
      ))}
    </div>
  );
}
