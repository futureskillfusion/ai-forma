import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { pageRequireTenantUser } from "@/lib/rbac";
import { BrandingForm } from "./branding-form";

export const metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const session = await pageRequireTenantUser();
  if (session.role !== "tenant_admin") redirect("/app");
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });

  return (
    <>
      <PageHeader
        title="Branding"
        description="White-label the customer widget within the limits your plan allows. Plan tier, feature flags and API keys are managed by Systematic IT Solutions."
      />
      <div className="max-w-xl">
        <Card>
          <CardContent className="pt-6">
            <BrandingForm
              initial={{ primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl ?? "" }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
