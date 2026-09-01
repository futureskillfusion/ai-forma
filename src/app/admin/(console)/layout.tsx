import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/shell";
import { pageRequireSuperAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Building2, Gauge, Power, ClipboardList } from "@/components/icons";

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  const session = await pageRequireSuperAdmin();
  const pendingRequests = await db.accessRequest.count({ where: { status: "pending" } });

  const nav: NavItem[] = [
    { href: "/admin", label: "Tenants", icon: <Building2 />, exact: true },
    {
      href: "/admin/requests",
      label: "Access requests",
      icon: <ClipboardList />,
      badge: pendingRequests || undefined,
    },
    { href: "/admin/usage", label: "Usage & margin", icon: <Gauge /> },
    { href: "/admin/platform", label: "Platform controls", icon: <Power /> },
  ];

  return (
    <AppShell
      nav={nav}
      signOutPath="/api/admin/auth/logout"
      user={{ name: session.name, email: session.email }}
      scopeLabel="Super admin"
    >
      {children}
    </AppShell>
  );
}
