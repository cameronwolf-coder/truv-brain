import { GovHero } from "@/components/gov-hero";
import { UseCaseCard } from "@/components/use-case-card";
import { USE_CASES } from "@/lib/use-cases";

export default function HomePage() {
  return (
    <div>
      <GovHero />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold tracking-tight">Verification Products</h2>
        <p className="mt-2 text-muted-foreground">
          Select a product to try a live demo with sandbox credentials.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.key} useCase={uc} />
          ))}
        </div>
      </section>
    </div>
  );
}
