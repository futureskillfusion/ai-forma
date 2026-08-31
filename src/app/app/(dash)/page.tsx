import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, Progress } from "@/components/ui/metrics";
import { StatusBadge } from "@/components/ui/badge";
import { CopyField } from "@/components/copy-field";
import { db } from "@/lib/db";
import { pageRequireTenantUser } from "@/lib/rbac";
import { resolvePlanLimit, TIER_LABEL } from "@/lib/plan";
import { tenantMonthlySpend, tenantMonthlyQueryCount } from "@/lib/usage";
import { embedSnippet, widgetUrl } from "@/lib/embed-snippet";
import { money2, relTime } from "@/lib/format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function TenantDashboard() {
  const session = await pageRequireTenantUser();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: session.tenantId } });
  const [limit, spend, queryCount, recent] = await Promise.all([
    resolvePlanLimit(tenant),
    tenantMonthlySpend(tenant.id),
    tenantMonthlyQueryCount(tenant.id),
    db.query.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const quotaPct = (queryCount / limit.maxQueriesPerMonth) * 100;

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.name.split(" ")[0]}`}
        description={`${tenant.name} · ${TIER_LABEL[tenant.planTier]} plan`}
        actions={<StatusBadge status={tenant.status} />}
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Queries this month
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums">
            {queryCount}
            <span className="text-base font-semibold text-[var(--color-muted-foreground)]"> / {limit.maxQueriesPerMonth}</span>
          </p>
          <div className="mt-3">
            <Progress value={queryCount} max={limit.maxQueriesPerMonth} tone={quotaPct > 90 ? "danger" : quotaPct > 75 ? "warning" : "primary"} />
          </div>
        </Card>
        <Stat label="AI usage (MTD)" value={money2(spend)} sub={`overage policy: ${limit.overagePolicy.replace(/_/g, " ")}`} />
        <Stat
          label="Regeneration rounds"
          value={limit.maxRegenerationRounds}
          sub={`${limit.imageModelTier} image model`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent customer queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                No queries yet. Add the embed snippet to your site to start receiving them.
              </p>
            )}
            {recent.map((q) => (
              <Link
                key={q.id}
                href={`/app/queries/${q.id}`}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {q.descriptionText || "Untitled idea"}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                    {q.customerName ?? "Anonymous"} · {relTime(q.createdAt)}
                  </span>
                </span>
                <span className="shrink-0">
                  <StatusBadge status={q.status} />
                </span>
              </Link>
            ))}
            {recent.length > 0 && (
              <Link href="/app/queries" className="mt-2 block px-3 text-sm font-semibold text-[var(--color-primary)] hover:underline">
                View all queries →
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your embed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Paste this on any page of your website. The widget keeps your site's URL — nothing changes for your visitors.
            </p>
            <CopyField value={embedSnippet(tenant.embedKey)} multiline />
            <Link
              href={widgetUrl(tenant.embedKey)}
              target="_blank"
              className="inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Preview the hosted widget →
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
