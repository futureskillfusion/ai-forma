import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { SignOutButton } from "./sign-out-button";
import { SidebarNav, type NavItem } from "./sidebar-nav";

export type { NavItem };

export function AppShell({
  nav,
  signOutPath,
  user,
  scopeLabel,
  children,
}: {
  nav: NavItem[];
  signOutPath: string;
  user: { name: string; email: string };
  scopeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-[var(--color-background)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)] md:flex">
        <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
          <Link href={nav[0]?.href ?? "/"}>
            <Logo />
          </Link>
        </div>
        <p className="px-5 pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {scopeLabel}
        </p>
        <SidebarNav items={nav} />
        <div className="border-t border-[var(--color-border)] p-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">{user.email}</p>
          <div className="mt-3">
            <SignOutButton path={signOutPath} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 md:hidden">
          <Logo />
          <SignOutButton path={signOutPath} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
