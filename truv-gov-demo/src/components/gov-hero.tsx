import { Badge } from "@/components/ui/badge";

const STATS = [
  { value: "96%", label: "US Workforce Coverage" },
  { value: "13,000+", label: "Financial Institutions" },
  { value: "<2s", label: "Average Response Time" },
  { value: "99.9%", label: "API Uptime" },
];

const COMPLIANCE = ["SOC 2 Type II", "FCRA Compliant", "FedRAMP Ready", "FISMA Compatible"];

export function GovHero() {
  return (
    <section className="relative overflow-hidden bg-navy px-6 py-16 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(44,100,227,0.15),_transparent_70%)]" />
      <div className="relative mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-2 mb-6">
          {COMPLIANCE.map((badge) => (
            <Badge
              key={badge}
              variant="outline"
              className="border-white/20 bg-white/5 text-white/80 text-xs"
            >
              {badge}
            </Badge>
          ))}
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Trusted Verification
          <br />
          Infrastructure for Government
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/70">
          Real-time income, employment, asset, and insurance verification — built for
          government agencies, federal lenders, and public sector compliance teams.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
