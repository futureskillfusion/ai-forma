import Link from "next/link";
import { MarketingShell } from "@/components/marketing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  { n: "01", t: "Describe", d: "Your customer types a product idea and picks an image model — no dimensions or jargon required." },
  { n: "02", t: "Visualise", d: "AI returns image concepts each round, every one run through a printability check." },
  { n: "03", t: "Rank & refine", d: "The customer drags concepts into a preference order and requests changes until it's right." },
  { n: "04", t: "Hand off", d: "A compiled brief plus a booked appointment lands with one of your designers." },
];

export default function Home() {
  return (
    <MarketingShell>
      <section className="bg-grid relative overflow-hidden border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
            AI design intake · for 3D printing &amp; manufacturing
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Turn “can you make this?” into a designer-ready brief
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--color-muted-foreground)]">
            AI Forma is an intake widget you embed on your own website. Customers describe an idea,
            AI generates concepts they rank and refine, and your designer receives a complete brief
            with a booked appointment — before the first call.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request-access">
              <Button size="lg">Request access</Button>
            </Link>
            <Link href="/w/fk_demo_3d2u_public_key_01">
              <Button size="lg" variant="outline">
                See the customer widget
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            Already a customer? <Link href="/app/login" className="font-semibold text-[var(--color-primary)] hover:underline">Sign in</Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-sm font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          How it works
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <Card key={s.n} className="p-5">
              <p className="text-xs font-extrabold text-[var(--color-primary)]">{s.n}</p>
              <p className="mt-2 text-base font-bold">{s.t}</p>
              <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-16 md:grid-cols-3">
          <Feature
            title="Embed on your own site"
            body="One script tag on any page of your website. Your domain and branding stay exactly as they are — the widget just appears where you want it."
          />
          <Feature
            title="Fewer unpaid consultations"
            body="Requirements, concepts and a confidence score arrive before a designer spends a minute. Vague briefs get a longer discovery slot; tight ones get a quick confirm."
          />
          <Feature
            title="You stay in control"
            body="Manage your designer roster and calendars, see every brief, and set your own branding — all from one dashboard."
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-2xl font-extrabold tracking-tight">Ready to try it on your site?</h2>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          Tell us about your business and we'll set up your account.
        </p>
        <div className="mt-6">
          <Link href="/request-access">
            <Button size="lg">Request access</Button>
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <Card className="flex flex-col p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-[var(--color-muted-foreground)]">{body}</p>
    </Card>
  );
}
