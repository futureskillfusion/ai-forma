import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { Button } from "./ui/button";

export function MarketingHeader() {
  return (
    <header className="glass sticky top-0 z-10 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/app/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/request-access">
            <Button size="sm">Request access</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-[var(--color-muted-foreground)] sm:flex-row">
        <p>AI Forma — a Systematic IT Solutions product</p>
        <nav className="flex items-center gap-4">
          <Link href="/legal/terms" className="hover:text-[var(--color-foreground)]">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-[var(--color-foreground)]">
            Privacy
          </Link>
          <Link href="/request-access" className="hover:text-[var(--color-foreground)]">
            Request access
          </Link>
          <Link href="/admin/login" className="hover:text-[var(--color-foreground)]">
            Platform admin
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-background)]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
