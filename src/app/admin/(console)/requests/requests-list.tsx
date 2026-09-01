"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Fieldset, Input, Select } from "@/components/ui/field";
import { CopyField } from "@/components/copy-field";
import { Check } from "@/components/icons";
import { relTime } from "@/lib/format";

interface AccessRequest {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  expectedMonthlyQueries: number | null;
  message: string | null;
  status: "pending" | "approved" | "declined";
  tenantId: string | null;
  declineReason: string | null;
  reviewedByEmail: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const RETAINER_DEFAULT: Record<string, number> = { starter: 450, pro: 1200, enterprise: 2500 };

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  for (const n of buf) out += chars[n % chars.length];
  return out;
}

export function RequestsList({ initial }: { initial: AccessRequest[] }) {
  const pending = initial.filter((r) => r.status === "pending");
  const reviewed = initial.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No pending requests.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <PendingCard key={r.id} request={r} />
            ))}
          </div>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Reviewed
          </h2>
          <div className="space-y-2">
            {reviewed.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{r.businessName}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {r.contactName} · {r.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                    {r.reviewedByEmail && <span>by {r.reviewedByEmail}</span>}
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                {r.declineReason && (
                  <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Reason: {r.declineReason}</p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PendingCard({ request }: { request: AccessRequest }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "decline" | "done">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; embedKey: string; password: string } | null>(null);

  const [form, setForm] = useState({
    planTier: "pro",
    retainerAmount: String(RETAINER_DEFAULT.pro),
    adminName: request.contactName,
    adminEmail: request.email,
    adminPassword: randomPassword(),
  });
  const [declineReason, setDeclineReason] = useState("");

  function setPlan(tier: string) {
    setForm((f) => ({ ...f, planTier: tier, retainerAmount: String(RETAINER_DEFAULT[tier] ?? f.retainerAmount) }));
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/access-requests/${request.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planTier: form.planTier,
          retainerAmount: Number(form.retainerAmount),
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Approval failed");
        return;
      }
      setResult({ slug: data.tenant.slug, embedKey: data.tenant.embedKey, password: form.adminPassword });
      setMode("done");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/access-requests/${request.id}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: declineReason || undefined }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Decline failed");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold">{request.businessName}</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {request.contactName} · {request.email}
              {request.phone ? ` · ${request.phone}` : ""}
            </p>
          </div>
          <span className="text-xs text-[var(--color-muted-foreground)]">{relTime(request.createdAt)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {request.website && (
            <Badge tone="neutral">
              <a href={request.website} target="_blank" rel="noreferrer" className="underline">
                {request.website.replace(/^https?:\/\//, "")}
              </a>
            </Badge>
          )}
          {request.expectedMonthlyQueries != null && (
            <Badge tone="info">~{request.expectedMonthlyQueries} intakes/mo</Badge>
          )}
        </div>

        {request.message && (
          <p className="mt-3 rounded-md bg-[var(--color-muted)]/50 p-3 text-sm italic">“{request.message}”</p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-destructive)]">
            {error}
          </p>
        )}

        {mode === "idle" && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => setMode("approve")}>
              Approve &amp; provision
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("decline")}>
              Decline
            </Button>
          </div>
        )}

        {mode === "approve" && (
          <div className="mt-4 space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fieldset label="Plan tier" htmlFor={`pt-${request.id}`}>
                <Select id={`pt-${request.id}`} value={form.planTier} onChange={(e) => setPlan(e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </Fieldset>
              <Fieldset label="Monthly retainer (USD)" htmlFor={`ra-${request.id}`}>
                <Input
                  id={`ra-${request.id}`}
                  type="number"
                  min={1}
                  step={50}
                  value={form.retainerAmount}
                  onChange={(e) => setForm((f) => ({ ...f, retainerAmount: e.target.value }))}
                />
              </Fieldset>
              <Fieldset label="First admin name" htmlFor={`an-${request.id}`}>
                <Input
                  id={`an-${request.id}`}
                  value={form.adminName}
                  onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                />
              </Fieldset>
              <Fieldset label="First admin email" htmlFor={`ae-${request.id}`}>
                <Input
                  id={`ae-${request.id}`}
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                />
              </Fieldset>
            </div>
            <Fieldset label="Temporary password" htmlFor={`ap-${request.id}`} hint="Auto-generated — share it securely with the admin.">
              <div className="flex gap-2">
                <Input
                  id={`ap-${request.id}`}
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm((f) => ({ ...f, adminPassword: randomPassword() }))}
                >
                  Regenerate
                </Button>
              </div>
            </Fieldset>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={approve}>
                {busy ? "Provisioning…" : "Provision tenant"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "decline" && (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4">
            <Fieldset label="Reason (optional, internal)" htmlFor={`dr-${request.id}`}>
              <Input
                id={`dr-${request.id}`}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </Fieldset>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy} onClick={decline}>
                {busy ? "Declining…" : "Confirm decline"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "done" && result && (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-success)]/40 bg-emerald-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-success)]">
              <Check className="h-4 w-4" /> Tenant provisioned — /{result.slug}
            </p>
            <CopyField label="First admin email" value={form.adminEmail} />
            <CopyField label="Temporary password" value={result.password} />
            <CopyField label="Embed key" value={result.embedKey} />
            <Button size="sm" variant="outline" onClick={() => router.refresh()}>
              Done
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
