"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Select } from "@/components/ui/field";

const RETAINER_HINT: Record<string, string> = {
  starter: "Suggested $400–500/mo",
  pro: "Suggested $1,000–1,300/mo",
  enterprise: "Negotiated, $2,500+/mo",
};

export function NewTenantForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    planTier: "pro",
    retainerAmount: "1200",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    origin: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          planTier: form.planTier,
          retainerAmount: Number(form.retainerAmount),
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
          embedAllowedOrigins: form.origin ? [form.origin] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create tenant");
        return;
      }
      router.push(`/admin/tenants/${data.tenant.id}`);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Fieldset label="Business name" htmlFor="name">
        <Input id="name" required value={form.name} onChange={set("name")} placeholder="3D-2U" />
      </Fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Fieldset label="Plan tier" htmlFor="planTier" hint={RETAINER_HINT[form.planTier]}>
          <Select id="planTier" value={form.planTier} onChange={set("planTier")}>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </Fieldset>
        <Fieldset label="Monthly retainer (USD)" htmlFor="retainerAmount">
          <Input
            id="retainerAmount"
            type="number"
            min={1}
            step={50}
            required
            value={form.retainerAmount}
            onChange={set("retainerAmount")}
          />
        </Fieldset>
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
        <p className="mb-4 text-sm font-bold">First tenant admin</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fieldset label="Name" htmlFor="adminName">
              <Input id="adminName" required value={form.adminName} onChange={set("adminName")} />
            </Fieldset>
            <Fieldset label="Email" htmlFor="adminEmail">
              <Input id="adminEmail" type="email" required value={form.adminEmail} onChange={set("adminEmail")} />
            </Fieldset>
          </div>
          <Fieldset
            label="Temporary password"
            htmlFor="adminPassword"
            hint="Share securely; they can change it after first sign-in. Min 8 characters."
          >
            <Input
              id="adminPassword"
              type="text"
              minLength={8}
              required
              value={form.adminPassword}
              onChange={set("adminPassword")}
            />
          </Fieldset>
        </div>
      </div>

      <Fieldset
        label="Allowed embed origin (optional)"
        htmlFor="origin"
        hint="The website that may host the widget, e.g. https://3d-2u.com"
      >
        <Input id="origin" type="url" value={form.origin} onChange={set("origin")} placeholder="https://3d-2u.com" />
      </Fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Creating…" : "Create tenant"}
        </Button>
      </div>
    </form>
  );
}
