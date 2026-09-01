import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";
import { resolvePlanLimit } from "@/lib/plan";

const Body = z.object({
  overallMatchPct: z.number().int().min(0).max(100),
  // Category scores are optional now — the widget only asks for an overall
  // match % plus free-text feedback. Default so historic/DB shape is unchanged.
  shapeScore: z.enum(["off", "good", "close"]).default("good"),
  sizeScore: z.enum(["too_big", "good", "too_small"]).default("good"),
  materialScore: z.enum(["off", "good", "close"]).default("good"),
  annotationData: z
    .object({
      markups: z.array(
        z.object({ x: z.number(), y: z.number(), note: z.string().max(400) }),
      ),
    })
    .optional(),
  changeRequestText: z.string().max(2000).optional(),
  // Ordered variation ids the customer dragged into their preference bucket,
  // top pick first. The first id should be this rating's variation.
  ranking: z.array(z.string().uuid()).max(12).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id: variationId } = await params;

    const variation = await db.variation.findFirst({
      where: { id: variationId, queryId: query.id },
    });
    if (!variation) throw new HttpError(404, "Variation not found for this query");

    const body = await readJson(req, Body);
    const { ranking, ...ratingData } = body;
    const rating = await db.rating.upsert({
      where: { variationId },
      create: { variationId, ...ratingData, annotationData: ratingData.annotationData ?? undefined },
      update: { ...ratingData, annotationData: ratingData.annotationData ?? undefined },
    });

    // Persist the customer's concept ranking for this session (last round wins).
    if (ranking && ranking.length > 0) {
      const validIds = new Set(
        (
          await db.variation.findMany({
            where: { id: { in: ranking }, queryId: query.id },
            select: { id: true },
          })
        ).map((v) => v.id),
      );
      const cleaned = ranking.filter((rid) => validIds.has(rid));
      if (cleaned.length > 0) {
        await db.query.update({
          where: { id: query.id },
          data: { conceptRankingJson: cleaned },
        });
      }
    }

    const limit = await resolvePlanLimit(
      await db.tenant.findUniqueOrThrow({ where: { id: query.tenantId } }),
    );
    const roundsUsed = (
      await db.variation.findMany({
        where: { queryId: query.id },
        distinct: ["roundNumber"],
        select: { roundNumber: true },
      })
    ).length;

    const meetsThreshold = rating.overallMatchPct >= query.matchThreshold;
    const canIterate = roundsUsed < limit.maxRegenerationRounds;

    if (query.status === "generating" || query.status === "describing") {
      await db.query.update({ where: { id: query.id }, data: { status: "rating" } });
    }

    return Response.json({
      rating: { id: rating.id, overallMatchPct: rating.overallMatchPct },
      guidance: {
        meetsThreshold,
        canIterate,
        threshold: query.matchThreshold,
        roundsUsed,
        maxRounds: limit.maxRegenerationRounds,
        // The widget uses this to decide: show "refine" vs "looks good, proceed".
        recommend: meetsThreshold ? "proceed" : canIterate ? "iterate" : "escalate_or_proceed",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
