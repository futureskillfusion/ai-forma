"use client";

import { useState } from "react";
import { Check, Copy } from "@/components/icons";
import { cn } from "@/lib/cn";

export function CopyField({
  value,
  label,
  multiline = false,
  className,
}: {
  value: string;
  label?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={className}>
      {label && (
        <p className="mb-1.5 text-sm font-semibold text-[var(--color-foreground)]">{label}</p>
      )}
      <div className="flex items-stretch gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/50 px-3 py-2 text-xs text-[var(--color-foreground)]",
            multiline ? "whitespace-pre-wrap break-all" : "truncate",
          )}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
