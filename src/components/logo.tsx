import { cn } from "@/lib/cn";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      {showText && (
        <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">Forma Intake</span>
      )}
    </span>
  );
}
