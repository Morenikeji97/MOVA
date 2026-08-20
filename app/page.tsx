import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VinData } from "@/components/ui/vin-data";

export default function Home() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="font-mono text-sm uppercase tracking-widest text-marine-400">
            Houston, TX → Lagos, NG
          </p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight">
            American cars. Global buyers.
          </h1>
          <p className="mt-4 max-w-xl text-ink-100">
            MOVA connects verified U.S. sellers with international buyers —
            starting in Nigeria.
          </p>
          <div className="mt-8 flex gap-3">
            <Button variant="primary" size="lg">Browse Vehicles</Button>
            <Button
              variant="secondary"
              size="lg"
              className="border-white text-white hover:bg-white/10"
            >
              List Your Vehicle
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-6 font-mono text-xs uppercase tracking-wider text-ink-400">
          Sample vehicle card — design system preview
        </h2>
        <div className="max-w-sm rounded-lg border border-paper-200 bg-paper-100 p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <h3 className="text-lg font-semibold text-ink-900">
              2019 Toyota Camry SE
            </h3>
            <VerifiedBadge />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <VinData label="Mileage" value="62,000 mi" />
            <VinData label="Location" value="Houston, TX" />
            <VinData label="Price" value="$14,500" />
            <VinData label="VIN" value="4T1B11HK..." />
          </div>
        </div>
      </section>
    </main>
  );
}
