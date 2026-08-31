import { PageHeader } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/metrics";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { db } from "@/lib/db";
import { monthRange } from "@/lib/usage";
import { tenantMetrics } from "@/lib/tenant-metrics";
import { money0, money2, pct } from "@/lib/format";

export const metadata = { title: "Usage & margin" };
export const dynamic = "force-dynamic";

const VENDOR_LABEL: Record<string, string> = {
  whisper: "Voice transcription",
  image_gen: "Image generation",
  llm: "LLM (feasibility + summary)",
  sms: "SMS",
  email: "Email",
};

export default async function UsagePage() {
  const { start, end } = monthRange();
  const tenants = await db.tenant.findMany({ orderBy: { name: "asc" } });
  const rows = await Promise.all(tenants.map(async (t) => ({ t, m: await tenantMetrics(t) })));

  const byVendor = await db.usageLog.groupBy({
    by: ["vendor"],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { costUsd: true },
    _count: true,
  });

  const revenue = rows.filter((r) => r.t.status !== "suspended").reduce((s, r) => s + r.m.retainerUsd, 0);
  const spend = byVendor.reduce((s, r) => s + Number(r._sum.costUsd ?? 0), 0);
  const margin = revenue - spend;

  return (
    <>
      <PageHeader
        title="Usage & margin"
        description="Platform-wide revenue against AI spend for the current calendar month."
      />

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Recurring revenue" value={money0(revenue)} sub="active retainers" />
        <Stat label="Vendor spend (MTD)" value={money2(spend)} />
        <Stat label="Margin" value={money0(margin)} tone={margin >= 0 ? "positive" : "negative"} sub={revenue ? pct((margin / revenue) * 100) : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend by vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byVendor.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No usage this month.</p>}
            {byVendor
              .slice()
              .sort((a, b) => Number(b._sum.costUsd ?? 0) - Number(a._sum.costUsd ?? 0))
              .map((v) => {
                const cost = Number(v._sum.costUsd ?? 0);
                const width = spend > 0 ? (cost / spend) * 100 : 0;
                return (
                  <div key={v.vendor}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold">{VENDOR_LABEL[v.vendor] ?? v.vendor}</span>
                      <span className="tabular-nums">{money2(cost)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader>
            <CardTitle>Margin by tenant</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <THead>
                <TR>
                  <TH>Tenant</TH>
                  <TH className="text-right">Retainer</TH>
                  <TH className="text-right">Spend</TH>
                  <TH className="text-right">Margin</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(({ t, m }) => (
                  <TR key={t.id}>
                    <TD className="font-semibold">{t.name}</TD>
                    <TD className="text-right tabular-nums">{money0(m.retainerUsd)}</TD>
                    <TD className="text-right tabular-nums">{money2(m.monthSpendUsd)}</TD>
                    <TD className={`text-right tabular-nums font-semibold ${m.marginUsd < 0 ? "text-[var(--color-destructive)]" : "text-[var(--color-success)]"}`}>
                      {money0(m.marginUsd)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
