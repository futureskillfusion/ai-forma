import type { ReactNode } from "react";
import { CircleAlert, ShieldCheck } from "@/components/icons";

export function WidgetShell({
  brandName,
  primaryColor = "#2563EB",
  logoUrl,
  children,
}: {
  brandName: string;
  primaryColor?: string;
  logoUrl?: string | null;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-grid"
      style={{ ["--brand" as string]: primaryColor }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:py-12">
        <header className="mb-6 flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-8 w-auto" />
          ) : (
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-sm font-extrabold text-white"
              style={{ background: primaryColor }}
            >
              {brandName.slice(0, 1)}
            </span>
          )}
          <div>
            <p className="text-sm font-extrabold leading-tight">{brandName}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">Design intake</p>
          </div>
        </header>
        {children}
        <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Your idea stays confidential · powered by AI Forma
        </footer>
      </div>
    </div>
  );
}

export function WidgetUnavailable({ message }: { message: string }) {
  return (
    <div className="glass rounded-2xl border p-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        <CircleAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-lg font-extrabold">Intake is unavailable</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">{message}</p>
    </div>
  );
}
