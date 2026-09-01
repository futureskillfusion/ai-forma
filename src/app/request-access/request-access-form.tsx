"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Textarea } from "@/components/ui/field";
import { Check } from "@/components/icons";

export function RequestAccessForm() {
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    expectedMonthlyQueries: "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone || undefined,
          website: form.website || undefined,
          expectedMonthlyQueries: form.expectedMonthlyQueries
            ? Number(form.expectedMonthlyQueries)
            : undefined,
          message: form.message || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit your request");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Network error — please try again");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-[var(--color-success)]">
          <Check className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-extrabold">Request received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">
          Thanks — we'll review it and email <span className="font-semibold">{form.email}</span> with
          your account details and next steps.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Fieldset label="Business name" htmlFor="bn">
        <Input id="bn" required value={form.businessName} onChange={set("businessName")} placeholder="3D-2U" />
      </Fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fieldset label="Your name" htmlFor="cn">
          <Input id="cn" required value={form.contactName} onChange={set("contactName")} autoComplete="name" />
        </Fieldset>
        <Fieldset label="Work email" htmlFor="em">
          <Input id="em" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </Fieldset>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fieldset label="Phone" htmlFor="ph" hint="Optional">
          <Input id="ph" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </Fieldset>
        <Fieldset label="Website" htmlFor="ws" hint="Optional">
          <Input id="ws" type="url" value={form.website} onChange={set("website")} placeholder="https://" />
        </Fieldset>
      </div>
      <Fieldset
        label="Expected customer intakes / month"
        htmlFor="ev"
        hint="Rough estimate — helps us suggest a plan."
      >
        <Input
          id="ev"
          type="number"
          min={0}
          value={form.expectedMonthlyQueries}
          onChange={set("expectedMonthlyQueries")}
        />
      </Fieldset>
      <Fieldset label="Anything else?" htmlFor="ms" hint="Optional">
        <Textarea id="ms" rows={3} value={form.message} onChange={set("message")} />
      </Fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? "Submitting…" : "Submit request"}
      </Button>
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        By submitting you agree to our{" "}
        <Link href="/legal/terms" className="underline">Terms</Link> and{" "}
        <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}
