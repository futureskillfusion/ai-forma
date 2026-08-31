import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TR, TH, TD } from "@/components/ui/table";
import { db } from "@/lib/db";
import { pageRequireTenantUser } from "@/lib/rbac";
import { relTime } from "@/lib/format";

export const metadata = { title: "Customer queries" };
export const dynamic = "force-dynamic";

export default async function QueriesPage() {
  const session = await pageRequireTenantUser();
  const queries = await db.query.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { variations: true } },
      handoffPacket: { select: { id: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Customer queries"
        description="Every intake session from your embedded widget, newest first."
      />
      <Card className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Idea</TH>
              <TH>Customer</TH>
              <TH>Status</TH>
              <TH className="text-right">Variations</TH>
              <TH className="text-right">Created</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {queries.length === 0 && (
              <TR>
                <TD className="py-8 text-center text-[var(--color-muted-foreground)]" colSpan={6}>
                  No queries yet.
                </TD>
              </TR>
            )}
            {queries.map((q) => (
              <TR key={q.id}>
                <TD className="max-w-xs">
                  <span className="block truncate font-semibold">{q.descriptionText || "Untitled idea"}</span>
                  {q.handoffPacket && (
                    <span className="text-xs font-semibold text-[var(--color-success)]">Handoff packet ready</span>
                  )}
                </TD>
                <TD>{q.customerName ?? <span className="text-[var(--color-muted-foreground)]">Anonymous</span>}</TD>
                <TD>
                  <StatusBadge status={q.status} />
                </TD>
                <TD className="text-right tabular-nums">{q._count.variations}</TD>
                <TD className="text-right text-[var(--color-muted-foreground)]">{relTime(q.createdAt)}</TD>
                <TD className="text-right">
                  <Link href={`/app/queries/${q.id}`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                    Open
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
