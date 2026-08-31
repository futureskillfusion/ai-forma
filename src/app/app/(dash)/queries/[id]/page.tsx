import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ArrowLeft, TriangleAlert, CalendarClock } from "@/components/icons";
import { db } from "@/lib/db";
import { pageRequireTenantUser } from "@/lib/rbac";
import { dateTime } from "@/lib/format";
import { imageModelLabel, llmModelLabel } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function QueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageRequireTenantUser();
  const { id } = await params;

  // Tenant-scoped: the where clause pins tenantId from the session, never the URL.
  const query = await db.query.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      variations: { orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }], include: { rating: true } },
      handoffPacket: {
        include: { assignedDesigner: { select: { name: true } }, appointment: true, finalVariation: true },
      },
    },
  });
  if (!query) notFound();

  const rounds = [...new Set(query.variations.map((v) => v.roundNumber))].sort((a, b) => a - b);

  // Concept ranking → human labels ("Concept 2 (round 3)")
  const rankingIds = Array.isArray(query.conceptRankingJson)
    ? (query.conceptRankingJson as string[])
    : [];
  const rankingList = rankingIds
    .map((id) => {
      const v = query.variations.find((x) => x.id === id);
      if (!v) return null;
      const nth = query.variations.filter((x) => x.roundNumber === v.roundNumber).indexOf(v) + 1;
      return `Concept ${nth} (round ${v.roundNumber})`;
    })
    .filter((x): x is string => x !== null);

  return (
    <>
      <Link
        href="/app/queries"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> Customer queries
      </Link>
      <PageHeader
        title={query.descriptionText.slice(0, 80) || "Untitled idea"}
        description={`From ${query.customerName ?? "an anonymous customer"} · created ${dateTime(query.createdAt)}`}
        actions={<StatusBadge status={query.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {query.handoffPacket && (
            <Card className="border-[var(--color-success)]/40 bg-emerald-50/40">
              <CardHeader>
                <CardTitle>Handoff packet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{query.handoffPacket.summaryText}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {query.handoffPacket.assignedDesigner && (
                    <Badge tone="info">Designer: {query.handoffPacket.assignedDesigner.name}</Badge>
                  )}
                  <Badge tone="neutral">Compiled {dateTime(query.handoffPacket.compiledAt)}</Badge>
                </div>
                {query.handoffPacket.appointment && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--color-card)] p-3 text-sm">
                    <CalendarClock className="h-4 w-4 text-[var(--color-primary)]" />
                    <span>
                      {dateTime(query.handoffPacket.appointment.scheduledAt)} ·{" "}
                      {query.handoffPacket.appointment.durationMinutes} min ·{" "}
                      <span className="capitalize">{query.handoffPacket.appointment.confidenceTier}</span> confidence
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {rounds.map((round) => (
            <Card key={round}>
              <CardHeader>
                <CardTitle>Round {round}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {query.variations
                    .filter((v) => v.roundNumber === round)
                    .map((v) => (
                      <div key={v.id} className="space-y-2">
                        <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={v.imageUrl} alt={`Round ${round} variation`} className="h-full w-full object-cover" />
                        </div>
                        {v.feasibilityFlag && (
                          <p className="flex items-start gap-1 text-xs font-medium text-[var(--color-warning)]">
                            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {v.feasibilityNotes}
                          </p>
                        )}
                        {v.rating && (
                          <div className="rounded-md bg-[var(--color-muted)]/60 p-2 text-xs">
                            <p className="font-bold">{v.rating.overallMatchPct}% match</p>
                            <p className="text-[var(--color-muted-foreground)]">
                              shape {v.rating.shapeScore} · size {v.rating.sizeScore} · material {v.rating.materialScore}
                            </p>
                            {v.rating.changeRequestText && (
                              <p className="mt-1 italic">“{v.rating.changeRequestText}”</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {query.variations.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No image variations generated yet.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field k="Description" v={query.descriptionText || "—"} />
              <Field k="Image model" v={imageModelLabel(query.imageModelChoice)} />
              <Field k="Assistant model" v={llmModelLabel(query.llmChoice)} />
              {rankingList.length > 0 && (
                <Field k="Concept ranking" v={rankingList.map((r, i) => `#${i + 1} ${r}`).join("  ·  ")} />
              )}
              <Field k="Match threshold" v={`${query.matchThreshold}%`} />
              {query.dimensions && <Field k="Dimensions (legacy)" v={query.dimensions} />}
              {query.materialPreference && <Field k="Material (legacy)" v={query.materialPreference} />}
              <hr className="border-[var(--color-border)]" />
              <Field k="Consent" v={query.consentConfirmed ? `Confirmed ${dateTime(query.consentConfirmedAt!)}` : "Not confirmed"} />
              <Field k="Customer name" v={query.customerName ?? "—"} />
              <Field k="Customer email" v={query.customerEmail ?? "—"} />
              <Field k="Customer phone" v={query.customerPhone ?? "—"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">{k}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{v}</p>
    </div>
  );
}
