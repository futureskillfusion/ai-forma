"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Select } from "@/components/ui/field";
import { TriangleAlert } from "@/components/icons";

export function StatusControl({
  tenantId,
  status,
}: {
  tenantId: string;
  status: "active" | "over_cap" | "past_due" | "suspended";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspended = status === "suspended";

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: suspended ? "active" : "suspended",
          reason: suspended ? "Reactivated by platform admin" : "Suspended by platform admin",
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Update failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {suspended
          ? "This tenant is suspended. Their embed widget shows an “unavailable” message and no AI calls run."
          : "Suspending immediately disables the tenant's widget on their site and halts all AI spend. Their admin can still sign in to the billing screen."}
      </p>
      {error && <p className="mt-2 text-sm font-medium text-[var(--color-destructive)]">{error}</p>}
      <Button
        variant={suspended ? "primary" : "destructive"}
        className="mt-4"
        disabled={loading}
        onClick={toggle}
      >
        {loading ? "Working…" : suspended ? "Reactivate tenant" : "Suspend tenant"}
      </Button>
    </div>
  );
}

export function PlanLimitsForm({
  tenantId,
  initial,
  isOverride,
}: {
  tenantId: string;
  initial: {
    maxQueriesPerMonth: number;
    maxRegenerationRounds: number;
    imageModelTier: "standard" | "premium";
    designerSeats: number;
    overagePolicy: "hard_cutoff" | "auto_upgrade_prompt" | "metered_billing";
    monthlyCostCapUsd: number;
  };
  isOverride: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));
  const str = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/plan-limits`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Update failed" });
        return;
      }
      setMsg({ ok: true, text: "Saved — this now overrides the tier default for this tenant." });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!isOverride && (
        <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Currently using the tier default. Saving creates a tenant-specific override.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fieldset label="Max queries / month" htmlFor="mq">
          <Input id="mq" type="number" min={0} value={form.maxQueriesPerMonth} onChange={num("maxQueriesPerMonth")} />
        </Fieldset>
        <Fieldset label="Max regeneration rounds" htmlFor="mr">
          <Input id="mr" type="number" min={1} max={20} value={form.maxRegenerationRounds} onChange={num("maxRegenerationRounds")} />
        </Fieldset>
        <Fieldset label="Image model tier" htmlFor="it">
          <Select id="it" value={form.imageModelTier} onChange={str("imageModelTier")}>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </Select>
        </Fieldset>
        <Fieldset label="Designer seats" htmlFor="ds">
          <Input id="ds" type="number" min={1} value={form.designerSeats} onChange={num("designerSeats")} />
        </Fieldset>
        <Fieldset label="Overage policy" htmlFor="op">
          <Select id="op" value={form.overagePolicy} onChange={str("overagePolicy")}>
            <option value="hard_cutoff">Hard cutoff</option>
            <option value="auto_upgrade_prompt">Auto-upgrade prompt</option>
            <option value="metered_billing">Metered billing</option>
          </Select>
        </Fieldset>
        <Fieldset label="Monthly cost cap (USD)" htmlFor="cc" hint="Flags the tenant over_cap when spend exceeds this.">
          <Input id="cc" type="number" min={0} step={10} value={form.monthlyCostCapUsd} onChange={num("monthlyCostCapUsd")} />
        </Fieldset>
      </div>
      {msg && (
        <p className={`text-sm font-medium ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}>
          {msg.text}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save plan limits"}
      </Button>
    </form>
  );
}
