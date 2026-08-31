import * as React from "react";
import { cn } from "@/lib/cn";
import { Card } from "./card";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneCls =
    tone === "positive"
      ? "text-[var(--color-success)]"
      : tone === "negative"
        ? "text-[var(--color-destructive)]"
        : tone === "warning"
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-foreground)]";
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className={cn("mt-2 text-2xl font-extrabold tabular-nums tracking-tight", toneCls)}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{sub}</p> : null}
    </Card>
  );
}

export function Progress({
  value,
  max = 100,
  tone = "primary",
}: {
  value: number;
  max?: number;
  tone?: "primary" | "warning" | "danger";
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar =
    tone === "danger"
      ? "bg-[var(--color-destructive)]"
      : tone === "warning"
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-primary)]";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}
