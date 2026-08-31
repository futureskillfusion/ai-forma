import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "@/components/icons";
import { NewTenantForm } from "./new-tenant-form";

export const metadata = { title: "New tenant" };

export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tenants
      </Link>
      <PageHeader
        title="New tenant"
        description="Provision a manufacturing business. This creates their account, first admin user, subscription, and embed key."
      />
      <Card className="p-7">
        <NewTenantForm />
      </Card>
    </div>
  );
}
