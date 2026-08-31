import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  { n: "01", t: "Describe", d: "The customer types or speaks a product idea, with optional dimensions and material." },
  { n: "02", t: "Visualise", d: "AI returns 2–3 image variations per round, each with a printability check." },
  { n: "03", t: "Refine", d: "The customer rates the match, marks up the image, and requests changes until it's close." },
  { n: "04", t: "Hand off", d: "A compiled packet plus a booked appointment lands with a human 3D designer." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-background)]">
      <header className="glass sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            <Link href="/app/login">
              <Button variant="ghost" size="sm">Tenant sign in</Button>
            </Link>
            <Link href="/admin/login">
              <Button variant="outline" size="sm">Platform admin</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-grid relative overflow-hidden border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-6xl px-5 py-20 text-center md:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">
              Multi-tenant SaaS · operated by Systematic IT Solutions
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              AI-guided design intake for 3D printing &amp; manufacturing
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--color-muted-foreground)]">
              Manufacturing businesses embed Forma Intake on their own website. Customers turn a
              rough idea into a rated, annotated, print-checked brief — before a designer is ever booked.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/w/fk_demo_3d2u_public_key_01">
                <Button size="lg" variant="accent">Try the customer widget</Button>
              </Link>
              <Link href="/app/login">
                <Button size="lg" variant="outline">Tenant dashboard demo</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center text-sm font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            How the intake flow works
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
            <RoleCard
              title="Platform owner"
              body="Provision tenants, set plan limits and feature flags, watch AI cost against retainer, and stop any tenant whose subscription lapses."
              href="/admin/login"
              cta="Open admin console"
            />
            <RoleCard
              title="Manufacturer (tenant)"
              body="See every customer brief and handoff packet, manage your designer roster and calendars, and copy the embed snippet for your site."
              href="/app/login"
              cta="Open tenant dashboard"
            />
            <RoleCard
              title="End customer"
              body="A self-serve way to visualise an idea and book a designer, with a confidentiality guarantee up front."
              href="/w/fk_demo_3d2u_public_key_01"
              cta="Launch the widget"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] py-8 text-center text-xs text-[var(--color-muted-foreground)]">
        Forma Intake · a Systematic IT Solutions product · demo build
      </footer>
    </div>
  );
}

function RoleCard({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <Card className="flex flex-col p-6">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-[var(--color-muted-foreground)]">{body}</p>
      <Link href={href} className="mt-4">
        <Button variant="outline" size="sm" className="w-full">{cta}</Button>
      </Link>
    </Card>
  );
}
