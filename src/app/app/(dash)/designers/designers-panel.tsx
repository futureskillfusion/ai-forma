"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fieldset, Input } from "@/components/ui/field";
import { Plus } from "@/components/icons";

type Designer = { id: string; name: string; email: string; createdAt: string };

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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const full = seatsUsed >= seatCap;

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
      setForm({ name: "", email: "", password: "" });
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
            {seatsUsed} / {seatCap} seats
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-[var(--color-border)]">
          {designers.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{d.email}</p>
              </div>
            </li>
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
            <Fieldset label="Temporary password" htmlFor="dp" hint="Min 8 characters.">
              <Input id="dp" type="text" minLength={8} required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </Fieldset>
            {error && <p className="text-sm font-medium text-[var(--color-destructive)]">{error}</p>}
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
