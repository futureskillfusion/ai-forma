"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fieldset, Input } from "@/components/ui/field";
import { Plus, Pencil, X, Copy, Check } from "@/components/icons";

type Designer = { id: string; name: string; email: string; createdAt: string };

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

export function DesignersPanel({
  initial,
  seatsUsed,
  seatCap,
  canManage,
}: {
  initial: Designer[];
  seatsUsed: number;
  seatCap: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [designers, setDesigners] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: randomPassword() });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const full = designers.length >= seatCap;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/designers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add designer");
        return;
      }
      setDesigners((d) => [...d, data.designer]);
      setForm({ name: "", email: "", password: randomPassword() });
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Designer roster</CardTitle>
          <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
            {designers.length} / {seatCap} seats
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-destructive)]">
            {error}
          </p>
        )}

        <ul className="divide-y divide-[var(--color-border)]">
          {designers.map((d) => (
            <DesignerRow
              key={d.id}
              designer={d}
              canManage={canManage}
              onUpdated={(u) => setDesigners((list) => list.map((x) => (x.id === u.id ? u : x)))}
              onRemoved={(id) => {
                setDesigners((list) => list.filter((x) => x.id !== id));
                router.refresh();
              }}
            />
          ))}
          {designers.length === 0 && (
            <li className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">No designers yet.</li>
          )}
        </ul>

        {canManage && !open && (
          <Button variant="outline" size="sm" disabled={full} onClick={() => setOpen(true)}>
            <Plus /> {full ? "Seat limit reached" : "Add designer"}
          </Button>
        )}

        {canManage && open && (
          <form onSubmit={add} className="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fieldset label="Name" htmlFor="dn">
                <Input id="dn" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </Fieldset>
              <Fieldset label="Email" htmlFor="de">
                <Input id="de" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </Fieldset>
            </div>
            <Fieldset label="Temporary password" htmlFor="dp" hint="Auto-generated — share it securely; they can change it after signing in.">
              <div className="flex gap-2">
                <Input id="dp" type="text" minLength={8} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <Button type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}>
                  Regenerate
                </Button>
              </div>
            </Fieldset>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Adding…" : "Add designer"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DesignerRow({
  designer,
  canManage,
  onUpdated,
  onRemoved,
}: {
  designer: Designer;
  canManage: boolean;
  onUpdated: (d: Designer) => void;
  onRemoved: (id: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "edit">("idle");
  const [name, setName] = useState(designer.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newPw, setNewPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function patch(body: { name?: string; password?: string }) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tenant/designers/${designer.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Update failed");
        return false;
      }
      onUpdated(data.designer);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if ((await patch({ name })) === true) setMode("idle");
  }

  async function resetPassword() {
    const pw = randomPassword();
    if ((await patch({ password: pw })) === true) {
      setNewPw(pw);
      setCopied(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${designer.name}? They will lose access.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/tenant/designers/${designer.id}`, { method: "DELETE" });
      if (!res.ok) {
        setErr((await res.json()).error ?? "Could not remove");
        return;
      }
      onRemoved(designer.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "edit" ? (
          <div className="flex flex-1 items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs" />
            <Button size="sm" disabled={busy} onClick={saveName}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode("idle"); setName(designer.name); }}>Cancel</Button>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold">{designer.name}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{designer.email}</p>
          </div>
        )}

        {canManage && mode === "idle" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-input)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-muted)] cursor-pointer"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={resetPassword}
              className="rounded-md border border-[var(--color-input)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-muted)] cursor-pointer disabled:opacity-50"
            >
              Reset password
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-input)] px-2 py-1 text-xs font-semibold text-[var(--color-destructive)] hover:bg-red-50 cursor-pointer disabled:opacity-50"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        )}
      </div>

      {err && <p className="mt-2 text-xs font-medium text-[var(--color-destructive)]">{err}</p>}

      {newPw && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs">
          <span className="font-semibold text-[var(--color-success)]">New password:</span>
          <code className="rounded bg-[var(--color-card)] px-1.5 py-0.5 font-mono">{newPw}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(newPw).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={() => setNewPw(null)} className="ml-auto text-[var(--color-muted-foreground)] cursor-pointer">
            dismiss
          </button>
        </div>
      )}
    </li>
  );
}
