import { MarketingShell } from "@/components/marketing";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-5 py-16 text-sm leading-relaxed text-[var(--color-foreground)]">
        <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Placeholder — replace before launch.</p>

        <h2 className="mt-8 text-lg font-bold">1. The service</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          AI Forma is a hosted design-intake tool operated by Systematic IT Solutions and licensed to
          businesses (“customers”) on a monthly subscription. Customers embed the intake widget on
          their own websites for use by their end users.
        </p>

        <h2 className="mt-6 text-lg font-bold">2. Accounts &amp; subscriptions</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Access is granted after an account request is reviewed and approved. Subscriptions renew
          monthly. If payment fails or the subscription lapses, the embedded widget is paused until
          the balance is settled.
        </p>

        <h2 className="mt-6 text-lg font-bold">3. Acceptable use</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Customers are responsible for the content their end users submit and for complying with
          applicable law when using AI-generated output.
        </p>

        <h2 className="mt-6 text-lg font-bold">4. Liability</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          The service is provided “as is”. This placeholder document should be replaced with terms
          reviewed by counsel before production use.
        </p>
      </article>
    </MarketingShell>
  );
}
