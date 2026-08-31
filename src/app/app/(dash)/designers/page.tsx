import { PageHeader } from "@/components/shell";
import { db } from "@/lib/db";
import { pageRequireTenantUser } from "@/lib/rbac";
import { resolvePlanLimit } from "@/lib/plan";
import { DesignersPanel } from "./designers-panel";

export const metadata = { title: "Designers" };
export const dynamic = "force-dynamic";

export default async function DesignersPage() {
  const session = await pageRequireTenantUser();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const [designers, limit] = await Promise.all([
    db.tenantUser.findMany({
      where: { tenantId: tenant.id, role: "designer" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    resolvePlanLimit(tenant),
  ]);

  return (
    <>
      <PageHeader
        title="Designers"
        description="Staff who receive handoff packets and take customer appointments. Seat count is set by your plan."
      />
      <div className="max-w-2xl">
        <DesignersPanel
          initial={designers.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
          seatsUsed={designers.length}
          seatCap={limit.designerSeats}
          canManage={session.role === "tenant_admin"}
        />
      </div>
    </>
  );
}
