import { MarketingShell } from "@/components/marketing";
import { Card } from "@/components/ui/card";
import { RequestAccessForm } from "./request-access-form";

export const metadata = {
  title: "Request access",
  description: "Ask Systematic IT Solutions to set up an AI Forma account for your business.",
};

export default function RequestAccessPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-5 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight">Request access</h1>
        <p className="mt-2 text-[var(--color-muted-foreground)]">
          Tell us about your business. We review every request and set up your account with a first
          admin login and an embed snippet for your site.
        </p>
        <Card className="mt-8 p-7">
          <RequestAccessForm />
        </Card>
      </div>
    </MarketingShell>
  );
}
