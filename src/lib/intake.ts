import "server-only";
import type { Query } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./rbac";
import { verifyCustomerToken } from "./auth";
import { imageGen, llm, booking, IMAGE_PROVIDER } from "./adapters";
import { assertAiEnabled } from "./platform";
import { resolvePlanLimit } from "./plan";
import { logUsage } from "./usage";
import { imageCost, llmCost } from "./pricing";
import { deriveConfidenceTier } from "./confidence";
import { tenantAcceptsIntake } from "./tenant-context";

/** Load the query a customer bearer token is bound to, or throw. */
export async function requireCustomerQuery(req: Request): Promise<Query> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
  const claims = token ? await verifyCustomerToken(token) : null;
  if (!claims) throw new HttpError(401, "Missing or invalid customer session token");

  const query = await db.query.findUnique({ where: { id: claims.queryId } });
  // Defence in depth: token is signed, but still confirm the row's tenant matches.
  if (!query || query.tenantId !== claims.tenantId) {
    throw new HttpError(404, "Query not found");
  }
  return query;
}

/** Run one generation round for a query. Enforces kill switch + regen cap. */
export async function generateRound(query: Query) {
  await assertAiEnabled().catch(() => {
    throw new HttpError(503, "Image generation is temporarily disabled. Please try again later.");
  });

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: query.tenantId } });
  if (!tenantAcceptsIntake(tenant)) {
    throw new HttpError(403, "This intake form is not currently active.");
  }

  const limit = await resolvePlanLimit(tenant);
  const priorRounds = await db.variation.findMany({
    where: { queryId: query.id },
    distinct: ["roundNumber"],
    select: { roundNumber: true },
  });
  const nextRound = priorRounds.length + 1;
  if (nextRound > limit.maxRegenerationRounds) {
    // Loop exhausted without a confirmed match — escalate to a human.
    await db.query.update({ where: { id: query.id }, data: { status: "escalated" } });
    throw new HttpError(409, "MAX_ROUNDS_REACHED");
  }

  await db.query.update({ where: { id: query.id }, data: { status: "generating" } });

  const prompt = buildPrompt(query, nextRound);
  const { images, units } = await imageGen.generate({
    prompt,
    count: 2,
    tier: limit.imageModelTier,
    model: query.imageModelChoice,
    seed: `${query.id}:${nextRound}`,
  });
  await logUsage({
    tenantId: query.tenantId,
    queryId: query.id,
    vendor: "image_gen",
    // The free provider (Pollinations) has no per-image cost; a paid provider
    // would use the model price sheet.
    costUsd:
      IMAGE_PROVIDER === "mock" || IMAGE_PROVIDER === "pollinations" || IMAGE_PROVIDER === "huggingface"
        ? 0
        : imageCost(limit.imageModelTier, units, query.imageModelChoice),
    tokensOrUnits: units,
    meta: { round: nextRound, tier: limit.imageModelTier, model: query.imageModelChoice, provider: IMAGE_PROVIDER },
  });

  // Feasibility check (LLM) — advisory note attached to each variation.
  const feas = await llm.feasibilityCheck({
    description: query.descriptionText,
    model: query.llmChoice,
  });
  await logUsage({
    tenantId: query.tenantId,
    queryId: query.id,
    vendor: "llm",
    costUsd: llmCost(feas.tokens, query.llmChoice),
    tokensOrUnits: feas.tokens,
    meta: { purpose: "feasibility", round: nextRound, model: query.llmChoice },
  });

  const created = await db.$transaction(
    images.map((img) =>
      db.variation.create({
        data: {
          queryId: query.id,
          roundNumber: nextRound,
          imageUrl: img.url,
          generationPrompt: img.prompt,
          feasibilityFlag: feas.flagged,
          feasibilityNotes: feas.notes,
        },
      }),
    ),
  );

  await db.query.update({ where: { id: query.id }, data: { status: "rating" } });
  return { round: nextRound, variations: created, maxRounds: limit.maxRegenerationRounds };
}

function buildPrompt(query: Query, round: number): string {
  const parts = [query.descriptionText.trim()];
  if (round > 1) parts.push("(refined from customer feedback)");
  return parts.join(", ");
}

/** Compile the handoff packet once the customer confirms "close enough". */
export async function compileHandoff(query: Query, finalVariationId: string) {
  const variation = await db.variation.findFirst({
    where: { id: finalVariationId, queryId: query.id },
    include: { rating: true },
  });
  if (!variation) throw new HttpError(400, "Selected variation does not belong to this query");

  const ratings = await db.rating.findMany({
    where: { variation: { queryId: query.id } },
    include: { variation: true },
    orderBy: { createdAt: "asc" },
  });
  const rounds = ratings.map((r) => ({
    round: r.variation.roundNumber,
    overallMatchPct: r.overallMatchPct,
    changeRequest: r.changeRequestText,
  }));
  const finalMatchPct = variation.rating?.overallMatchPct ?? rounds.at(-1)?.overallMatchPct ?? 70;

  const ranking = Array.isArray(query.conceptRankingJson)
    ? (query.conceptRankingJson as string[])
    : [];

  const summary = await llm.compileHandoff({
    description: query.descriptionText,
    model: query.llmChoice,
    contact: { name: query.customerName, email: query.customerEmail, phone: query.customerPhone },
    rounds,
    ranking,
    finalMatchPct,
  });
  await logUsage({
    tenantId: query.tenantId,
    queryId: query.id,
    vendor: "llm",
    costUsd: llmCost(summary.tokens, query.llmChoice),
    tokensOrUnits: summary.tokens,
    meta: { purpose: "handoff_summary", model: query.llmChoice },
  });

  const { tier } = deriveConfidenceTier({
    finalMatchPct,
    descriptionLength: query.descriptionText.trim().length,
    hasContact: !!(query.customerEmail || query.customerPhone),
    roundCount: new Set(ratings.map((r) => r.variation.roundNumber)).size || 1,
    rankedConcepts: ranking.length > 1,
  });

  // Round-robin-ish assignment: pick the designer with the fewest open packets.
  const designers = await db.tenantUser.findMany({
    where: { tenantId: query.tenantId, role: "designer" },
    include: { _count: { select: { assignedPackets: true } } },
  });
  const assignee = designers.sort((a, b) => a._count.assignedPackets - b._count.assignedPackets)[0];

  const history = {
    description: query.descriptionText,
    contact: {
      name: query.customerName,
      email: query.customerEmail,
      phone: query.customerPhone,
    },
    llmChoice: query.llmChoice,
    imageModelChoice: query.imageModelChoice,
    conceptRanking: ranking,
    confidenceTier: tier,
    finalMatchPct,
    rounds,
  };

  const packet = await db.handoffPacket.upsert({
    where: { queryId: query.id },
    create: {
      queryId: query.id,
      finalVariationId: variation.id,
      summaryText: summary.summaryText,
      requirementHistoryJson: history,
      assignedDesignerId: assignee?.id ?? null,
    },
    update: {
      finalVariationId: variation.id,
      summaryText: summary.summaryText,
      requirementHistoryJson: history,
      assignedDesignerId: assignee?.id ?? null,
    },
  });

  await db.query.update({ where: { id: query.id }, data: { status: "handed_off" } });
  return { packet, confidenceTier: tier };
}

export async function bookForPacket(packetId: string, tenantId: string, slotStart: string) {
  const packet = await db.handoffPacket.findFirst({
    where: { id: packetId, query: { tenantId } },
    include: { query: true },
  });
  if (!packet) throw new HttpError(404, "Handoff packet not found");
  if (!packet.assignedDesignerId) throw new HttpError(409, "No designer is available to assign");

  const history = packet.requirementHistoryJson as { confidenceTier?: "high" | "standard" | "discovery" };
  const confidenceTier = history.confidenceTier ?? "standard";
  const { slots, durationMinutes } = await booking.getSlots({
    designerId: packet.assignedDesignerId,
    confidenceTier,
  });
  const chosen = slots.find((s) => s.start === slotStart) ?? slots[0];
  const { externalCalendarEventId } = await booking.book({
    designerId: packet.assignedDesignerId,
    start: chosen.start,
    durationMinutes: chosen.durationMinutes,
  });

  const appointment = await db.appointment.upsert({
    where: { handoffPacketId: packet.id },
    create: {
      handoffPacketId: packet.id,
      designerId: packet.assignedDesignerId,
      scheduledAt: new Date(chosen.start),
      durationMinutes: chosen.durationMinutes ?? durationMinutes,
      externalCalendarEventId,
      confidenceTier,
    },
    update: {
      scheduledAt: new Date(chosen.start),
      durationMinutes: chosen.durationMinutes ?? durationMinutes,
      externalCalendarEventId,
    },
  });

  await db.query.update({ where: { id: packet.queryId }, data: { status: "booked" } });
  return appointment;
}
