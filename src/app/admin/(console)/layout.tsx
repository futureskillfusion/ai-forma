import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/shell";
import { pageRequireSuperAdmin } from "@/lib/rbac";
import { Building2, Gauge, Power } from "@/components/icons";

const nav: NavItem[] = [
  { href: "/admin", label: "Tenants", icon: <Building2 />, exact: true },
  { href: "/admin/usage", label: "Usage & margin", icon: <Gauge /> },
  { href: "/admin/platform", label: "Platform controls", icon: <Power /> },
];

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  const session = await pageRequireSuperAdmin();
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
