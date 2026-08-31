import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell, type NavItem } from "@/components/shell";
import { SignOutButton } from "@/components/sign-out-button";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { pageRequireTenantUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { LayoutDashboard, Inbox, Users, Palette } from "@/components/icons";

const nav: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
  { href: "/app/queries", label: "Customer queries", icon: <Inbox /> },
  { href: "/app/designers", label: "Designers", icon: <Users /> },
  { href: "/app/branding", label: "Branding", icon: <Palette /> },
];

export default async function DashLayout({ children }: { children: ReactNode }) {
  const session = await pageRequireTenantUser();
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });

  if (!tenant || tenant.status === "suspended") {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-grid">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
          <Link href="/" className="mx-auto mb-8">
            <Logo />
          </Link>
          <Card className="p-8 text-center">
            <h1 className="text-xl font-extrabold">Account suspended</h1>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Your Forma Intake subscription is currently inactive, so the intake widget on your
              website is paused. Please settle the outstanding balance or contact Systematic IT
              Solutions to reactivate.
            </p>
            <div className="mx-auto mt-6 max-w-xs">
              <SignOutButton path="/api/app/auth/logout" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const designerNav = session.role === "designer" ? nav.filter((n) => n.href === "/app" || n.href === "/app/queries") : nav;

  return (
    <AppShell
      nav={designerNav}
      signOutPath="/api/app/auth/logout"
      user={{ name: session.name, email: session.email }}
      scopeLabel={tenant.name}
    >
      {children}
    </AppShell>
  );
}
