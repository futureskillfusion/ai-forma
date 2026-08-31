import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/metrics";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { Plus } from "@/components/icons";
import { db } from "@/lib/db";
import { tenantMetrics } from "@/lib/tenant-metrics";
import { money0, money2, pct } from "@/lib/format";
import { TIER_LABEL } from "@/lib/plan";

export const metadata = { title: "Tenants" };
export const dynamic = "force-dynamic";

export default async function AdminTenantsPage() {
  const tenants = await db.tenant.findMany({ orderBy: { createdAt: "desc" } });
  const rows = await Promise.all(tenants.map(async (t) => ({ t, m: await tenantMetrics(t) })));

  const revenue = rows.filter((r) => r.t.status !== "suspended").reduce((s, r) => s + r.m.retainerUsd, 0);
  const spend = rows.reduce((s, r) => s + r.m.monthSpendUsd, 0);
  const margin = revenue - spend;

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Every manufacturing business licensed on the platform, with this month's AI cost against their retainer."
        actions={
          <Link href="/admin/tenants/new">
            <Button size="sm">
              <Plus /> New tenant
            </Button>
          </Link>
        }
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Active MRR" value={money0(revenue)} sub={`${rows.filter((r) => r.t.status === "active").length} active tenants`} />
        <Stat label="AI spend (MTD)" value={money2(spend)} sub="all vendors, this month" />
        <Stat
          label="Platform margin"
          value={money0(margin)}
          tone={margin >= 0 ? "positive" : "negative"}
          sub={revenue ? pct((margin / revenue) * 100) + " of MRR" : "—"}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH className="text-right">Retainer</TH>
              <TH className="text-right">Spend MTD</TH>
              <TH className="text-right">Margin</TH>
              <TH className="text-right">Queries</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {rows.map(({ t, m }) => (
              <TR key={t.id}>
                <TD>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">/{t.slug}</p>
                </TD>
                <TD>{TIER_LABEL[t.planTier]}</TD>
                <TD>
                  <StatusBadge status={t.status} />
                </TD>
                <TD className="text-right tabular-nums">{money0(m.retainerUsd)}</TD>
                <TD className="text-right tabular-nums">{money2(m.monthSpendUsd)}</TD>
                <TD className={`text-right tabular-nums font-semibold ${m.marginUsd < 0 ? "text-[var(--color-destructive)]" : "text-[var(--color-success)]"}`}>
                  {money0(m.marginUsd)}
                </TD>
                <TD className="text-right tabular-nums">
                  {m.monthQueryCount}
                  <span className="text-[var(--color-muted-foreground)]"> / {m.queryCap}</span>
                </TD>
                <TD className="text-right">
                  <Link href={`/admin/tenants/${t.id}`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                    Manage
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
