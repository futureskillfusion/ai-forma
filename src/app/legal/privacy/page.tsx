import { MarketingShell } from "@/components/marketing";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-5 py-16 text-sm leading-relaxed text-[var(--color-foreground)]">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Placeholder — replace before launch.</p>

        <h2 className="mt-8 text-lg font-bold">What we collect</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Account-request details (business name, contact name, email, phone, website), customer
          account data, and the design descriptions, generated images, ratings and appointment
          details created through the intake widget.
        </p>

        <h2 className="mt-6 text-lg font-bold">How we use it</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          To provide the service, generate concepts via AI providers, compile briefs for the
          customer's design team, and bill subscriptions. Design descriptions and images are shared
          only with the customer's own team for the relevant request.
        </p>

        <h2 className="mt-6 text-lg font-bold">Sub-processors</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          AI image generation, transcription, LLM, payment, calendar and messaging providers. A
          current list will be published here before production use.
        </p>

        <h2 className="mt-6 text-lg font-bold">Your choices</h2>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Contact us to access or delete data associated with your account. This placeholder should
          be replaced with a policy reviewed by counsel.
        </p>
      </article>
    </MarketingShell>
  );
}
