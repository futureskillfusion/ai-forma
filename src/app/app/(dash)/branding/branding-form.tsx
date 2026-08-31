"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input } from "@/components/ui/field";

export function BrandingForm({
  initial,
}: {
  initial: { primaryColor: string; logoUrl: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tenant/branding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryColor: form.primaryColor, logoUrl: form.logoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Save failed" });
        return;
      }
      setMsg({ ok: true, text: "Branding saved." });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Fieldset label="Primary colour" htmlFor="pc" hint="Hex value used for the widget's buttons and accents.">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            className="h-11 w-14 cursor-pointer rounded-md border border-[var(--color-input)] bg-[var(--color-card)]"
            aria-label="Pick primary colour"
          />
          <Input
            id="pc"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            className="max-w-40"
          />
        </div>
      </Fieldset>

      <Fieldset label="Logo URL" htmlFor="lu" hint="Optional. Shown in the widget header.">
        <Input
          id="lu"
          type="url"
          placeholder="https://…"
          value={form.logoUrl}
          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
        />
      </Fieldset>

      <div className="rounded-md border border-[var(--color-border)] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">Preview</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-10 rounded-md px-4 text-sm font-semibold text-white"
            style={{ background: form.primaryColor }}
          >
            Generate images
          </button>
          <span className="text-sm text-[var(--color-muted-foreground)]">Button on your widget</span>
        </div>
      </div>

      {msg && (
        <p className={`text-sm font-medium ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}>
          {msg.text}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}
