"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Power } from "@/components/icons";

export function KillSwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const next = !enabled;
      const res = await fetch("/api/admin/kill-switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next, reason: next ? "Manual platform halt" : "Platform resumed" }),
      });
      if (res.ok) {
        setEnabled(next);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-lg border p-5 ${
        enabled ? "border-[var(--color-destructive)] bg-red-50" : "border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            enabled ? "bg-[var(--color-destructive)] text-white" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
          }`}
        >
          <Power className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-bold">Global AI kill switch</p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            When ON, every tenant's image-generation and transcription calls are blocked platform-wide.
            Customer widgets stay up and show a clear status. Existing bookings are unaffected.
          </p>
          <p className="mt-2 text-sm font-semibold">
            Status:{" "}
            <span className={enabled ? "text-[var(--color-destructive)]" : "text-[var(--color-success)]"}>
              {enabled ? "ON — AI vendor calls blocked" : "OFF — normal operation"}
            </span>
          </p>
          <Button
            className="mt-4"
            variant={enabled ? "primary" : "destructive"}
            disabled={loading}
            onClick={toggle}
          >
            {loading ? "Working…" : enabled ? "Turn kill switch OFF" : "Turn kill switch ON"}
          </Button>
        </div>
      </div>
    </div>
  );
}
