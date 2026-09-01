import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  over_cap: "warning",
  past_due: "warning",
  suspended: "danger",
  trialing: "info",
  canceled: "danger",
  describing: "neutral",
  generating: "info",
  rating: "info",
  handed_off: "success",
  booked: "success",
  escalated: "warning",
  pending: "warning",
  approved: "success",
  declined: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
