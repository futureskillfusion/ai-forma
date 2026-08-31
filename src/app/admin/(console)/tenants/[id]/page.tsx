import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/metrics";
import { CopyField } from "@/components/copy-field";
import { ArrowLeft } from "@/components/icons";
import { db } from "@/lib/db";
import { tenantMetrics } from "@/lib/tenant-metrics";
import { resolvePlanLimit, TIER_LABEL } from "@/lib/plan";
import { money0, money2, dateTime } from "@/lib/format";
import { embedSnippet, widgetUrl } from "@/lib/embed-snippet";
import { StatusControl, PlanLimitsForm } from "./tenant-controls";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      _count: { select: { queries: true } },
    },
  });
  if (!tenant) notFound();

  const [metrics, ownLimit, effLimit, audit] = await Promise.all([
    tenantMetrics(tenant),
    db.planLimit.findUnique({ where: { tenantId: tenant.id } }),
    resolvePlanLimit(tenant),
    db.auditLog.findMany({
      where: { targetTenant: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const admins = tenant.users.filter((u) => u.role === "tenant_admin");
  const designers = tenant.users.filter((u) => u.role === "designer");

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Tenants
      </Link>
      <PageHeader
        title={tenant.name}
        description={`/${tenant.slug} · ${TIER_LABEL[tenant.planTier]} plan`}
        actions={<StatusBadge status={tenant.status} />}
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Retainer" value={money0(metrics.retainerUsd)} sub="per month" />
        <Stat label="Spend MTD" value={money2(metrics.monthSpendUsd)} sub={`cap ${money0(metrics.costCapUsd)}`} tone={metrics.overCostCap ? "warning" : "default"} />
        <Stat label="Margin MTD" value={money0(metrics.marginUsd)} tone={metrics.marginUsd < 0 ? "negative" : "positive"} />
        <Stat label="Queries MTD" value={`${metrics.monthQueryCount} / ${metrics.queryCap}`} sub={`${tenant._count.queries} all-time`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Plan limits &amp; feature flags</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanLimitsForm
                tenantId={tenant.id}
                isOverride={!!ownLimit}
                initial={{
                  maxQueriesPerMonth: effLimit.maxQueriesPerMonth,
                  maxRegenerationRounds: effLimit.maxRegenerationRounds,
                  imageModelTier: effLimit.imageModelTier,
                  designerSeats: effLimit.designerSeats,
                  overagePolicy: effLimit.overagePolicy,
                  monthlyCostCapUsd: Number(effLimit.monthlyCostCapUsd),
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Embed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CopyField label="Embed key" value={tenant.embedKey} />
              <CopyField label="Snippet for the tenant's website" value={embedSnippet(tenant.embedKey)} multiline />
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Hosted widget:{" "}
                <Link href={widgetUrl(tenant.embedKey)} className="font-semibold text-[var(--color-primary)] hover:underline" target="_blank">
                  {widgetUrl(tenant.embedKey)}
                </Link>
              </p>
              {tenant.embedAllowedOrigins.length > 0 && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Allowed origins: {tenant.embedAllowedOrigins.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription &amp; status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row k="Billing status" v={<StatusBadge status={tenant.subscriptionStatus} />} />
              <Row k="Period ends" v={tenant.currentPeriodEnd ? dateTime(tenant.currentPeriodEnd) : "—"} />
              <hr className="border-[var(--color-border)]" />
              <StatusControl tenantId={tenant.id} status={tenant.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {admins.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <span>{u.name}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">admin</span>
                </div>
              ))}
              {designers.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <span>{u.name}</span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">designer</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-[var(--color-muted-foreground)]">
                {designers.length} / {effLimit.designerSeats} designer seats used
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent admin actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {audit.length === 0 && <p className="text-[var(--color-muted-foreground)]">No actions logged.</p>}
              {audit.map((a) => (
                <div key={a.id} className="text-xs">
                  <span className="font-semibold capitalize">{a.action.replace(/_/g, " ")}</span>
                  <span className="text-[var(--color-muted-foreground)]">
                    {" "}
                    · {a.actor.name} · {dateTime(a.createdAt)}
                  </span>
                  {a.reason && <p className="text-[var(--color-muted-foreground)]">{a.reason}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-muted-foreground)]">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
