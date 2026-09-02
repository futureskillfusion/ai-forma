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

type PickEntry = { variationId: string; matchPct: number };

export default async function QueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await pageRequireTenantUser();
  const { id } = await params;

  // Tenant-scoped: the where clause pins tenantId from the session, never the URL.
  const query = await db.query.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      variations: { orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }], include: { rating: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      handoffPacket: {
        include: { assignedDesigner: { select: { name: true } }, appointment: true, finalVariation: true },
      },
    },
  });
  if (!query) notFound();

  const rounds = [...new Set(query.variations.map((v) => v.roundNumber))].sort((a, b) => a - b);
  const conceptLabel = (variationId: string) => {
    const v = query.variations.find((x) => x.id === variationId);
    if (!v) return "Concept";
    const nth = query.variations.filter((x) => x.roundNumber === v.roundNumber).indexOf(v) + 1;
    return `Concept ${nth} · round ${v.roundNumber}`;
  };

  // conceptRankingJson is now [{ variationId, matchPct }] (older rows: string[]).
  const raw = query.conceptRankingJson;
  const picks: PickEntry[] = Array.isArray(raw)
    ? raw.map((r) =>
        typeof r === "string"
          ? { variationId: r, matchPct: 0 }
          : (r as PickEntry),
      )
    : [];
  const pickVariations = picks
    .map((p) => ({ ...p, v: query.variations.find((x) => x.id === p.variationId) }))
    .filter((p) => p.v);

  const hasCustomerInputs =
    pickVariations.length > 0 || !!query.customerNote || query.selfServe || query.attachments.length > 0;

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
          {/* ── Customer's picks & inputs ─────────────────────────────── */}
          {hasCustomerInputs && (
            <Card className="border-[var(--color-primary)]/30 bg-blue-50/40">
              <CardHeader>
                <CardTitle>What the customer chose &amp; sent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {query.selfServe && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    The customer didn&apos;t find an AI concept close enough and sent their own details for the designer to work from.
                  </p>
                )}

                {pickVariations.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Picked concepts ({pickVariations.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {pickVariations.map(({ variationId, matchPct, v }, i) => (
                        <div key={variationId} className="space-y-1">
                          <div className="relative overflow-hidden rounded-md border-2 border-[var(--color-primary)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={v!.imageUrl} alt="" className="aspect-square w-full object-cover" />
                            <span className="absolute left-1 top-1 rounded bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              Pick {i + 1}
                            </span>
                          </div>
                          <p className="text-xs font-semibold">{matchPct}% match</p>
                          <p className="text-[10px] text-[var(--color-muted-foreground)]">{conceptLabel(variationId)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {query.customerNote && (
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Customer&apos;s note to the designer
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-[var(--color-card)] p-3 text-sm italic">
                      “{query.customerNote}”
                    </p>
                  </div>
                )}

                {query.attachments.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Uploads &amp; sketches ({query.attachments.length})
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {query.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative block overflow-hidden rounded-md border border-[var(--color-border)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.label ?? a.kind} className="aspect-square w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">
                            {a.kind === "drawing" ? "sketch" : a.kind === "self_serve" ? "file" : "reference"}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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

          {query.variations.length === 0 && !query.selfServe && (
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
              <Field k="Route" v={query.selfServe ? "Customer-supplied details" : "AI concepts"} />
              <Field k="Match threshold" v={`${query.matchThreshold}%`} />
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
