import "server-only";
import type { Query } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./rbac";
import { verifyCustomerToken } from "./auth";
import { imageGen, llm, booking, IMAGE_PROVIDER } from "./adapters";
import { assertAiEnabled } from "./platform";
import { resolvePlanLimit } from "./plan";
import { logUsage } from "./usage";
import { imageCost, llmCost } from "./pricing";
import { deriveConfidenceTier } from "./confidence";
import { tenantAcceptsIntake } from "./tenant-context";
import { matchLibrary, libraryRoundImages } from "./image-library";

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

  // 1) Curated library — if the idea matches an existing product line
  //    (e.g. "grip"), show the real product photos instead of AI images.
  const lib = matchLibrary(query.descriptionText);
  if (lib) {
    const urls = libraryRoundImages(lib, nextRound, 2);
    await logUsage({
      tenantId: query.tenantId,
      queryId: query.id,
      vendor: "image_gen",
      costUsd: 0,
      tokensOrUnits: urls.length,
      meta: { round: nextRound, provider: "library", library: lib.id },
    });
    const createdLib = await db.$transaction(
      urls.map((url) =>
        db.variation.create({
          data: {
            queryId: query.id,
            roundNumber: nextRound,
            imageUrl: url,
            generationPrompt: `${lib.label} (from product library)`,
            feasibilityFlag: false,
            feasibilityNotes: null,
          },
        }),
      ),
    );
    await db.query.update({ where: { id: query.id }, data: { status: "rating" } });
    return { round: nextRound, variations: createdLib, maxRounds: limit.maxRegenerationRounds };
  }

  // 2) Otherwise generate. If the customer attached a reference image or a
  //    sketch, pass the newest one as an img2img steer.
  const ref = await db.attachment.findFirst({
    where: { queryId: query.id, kind: { in: ["reference", "drawing"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const referenceUrl = ref
    ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/attachments/${ref.id}`
    : null;

  const { images, units } = await imageGen.generate({
    prompt,
    count: 2,
    tier: limit.imageModelTier,
    model: query.imageModelChoice,
    seed: `${query.id}:${nextRound}`,
    referenceUrl,
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
export interface CompileHandoffOpts {
  /** Concept picks, lead pick first. Empty ⇒ self-serve. */
  finalVariationIds?: string[];
  selfServe?: boolean;
  customerNote?: string | null;
}

export async function compileHandoff(query: Query, opts: CompileHandoffOpts) {
  const pickIds = (opts.finalVariationIds ?? []).filter(Boolean);
  const selfServe = opts.selfServe || pickIds.length === 0;

  // Load & validate the picked variations (each with its rating).
  const picks = pickIds.length
    ? await db.variation.findMany({
        where: { id: { in: pickIds }, queryId: query.id },
        include: { rating: true },
      })
    : [];
  if (pickIds.length && picks.length !== pickIds.length) {
    throw new HttpError(400, "A picked concept does not belong to this query");
  }
  // Keep the customer's order.
  picks.sort((a, b) => pickIds.indexOf(a.id) - pickIds.indexOf(b.id));
  const lead = picks[0] ?? null;

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
  const finalMatchPct =
    lead?.rating?.overallMatchPct ?? rounds.at(-1)?.overallMatchPct ?? (selfServe ? 0 : 70);

  const attachments = await db.attachment.findMany({
    where: { queryId: query.id },
    orderBy: { createdAt: "asc" },
  });

  const pickSummaries = picks.map((v, i) => ({
    label: `Concept (round ${v.roundNumber})`,
    matchPct: v.rating?.overallMatchPct ?? finalMatchPct,
    variationId: v.id,
    order: i + 1,
  }));

  const summary = await llm.compileHandoff({
    description: query.descriptionText,
    model: query.llmChoice,
    contact: { name: query.customerName, email: query.customerEmail, phone: query.customerPhone },
    rounds,
    finalMatchPct,
    picks: pickSummaries.map((p) => ({ label: p.label, matchPct: p.matchPct })),
    customerNote: opts.customerNote ?? query.customerNote,
    attachmentCount: attachments.length,
    selfServe,
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
    rankedConcepts: picks.length > 1,
  });

  const designers = await db.tenantUser.findMany({
    where: { tenantId: query.tenantId, role: "designer" },
    include: { _count: { select: { assignedPackets: true } } },
  });
  const assignee = designers.sort((a, b) => a._count.assignedPackets - b._count.assignedPackets)[0];

  const history = {
    description: query.descriptionText,
    contact: { name: query.customerName, email: query.customerEmail, phone: query.customerPhone },
    llmChoice: query.llmChoice,
    imageModelChoice: query.imageModelChoice,
    picks: pickSummaries,
    selfServe,
    customerNote: opts.customerNote ?? query.customerNote,
    attachments: attachments.map((a) => ({ id: a.id, kind: a.kind, mimeType: a.mimeType, label: a.label })),
    confidenceTier: tier,
    finalMatchPct,
    rounds,
  };

  await db.query.update({
    where: { id: query.id },
    data: {
      selfServe,
      customerNote: opts.customerNote ?? query.customerNote ?? undefined,
      conceptRankingJson: pickSummaries.map((p) => ({ variationId: p.variationId, matchPct: p.matchPct })),
    },
  });

  const data = {
    finalVariationId: lead?.id ?? null,
    summaryText: summary.summaryText,
    requirementHistoryJson: history,
    assignedDesignerId: assignee?.id ?? null,
  };
  const packet = await db.handoffPacket.upsert({
    where: { queryId: query.id },
    create: { queryId: query.id, ...data },
    update: data,
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
