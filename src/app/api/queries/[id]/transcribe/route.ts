import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";
import { transcription } from "@/lib/adapters";
import { assertAiEnabled } from "@/lib/platform";
import { logUsage } from "@/lib/usage";
import { whisperCost } from "@/lib/pricing";

// Stub: in production this accepts a multipart upload. Here it takes a URL/ref
// to already-stored audio and returns the transcript.
const Body = z.object({ audioUrl: z.string().min(1).max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");

    await assertAiEnabled().catch(() => {
      throw new HttpError(503, "Transcription is temporarily disabled. Please type your idea instead.");
    });

    const { audioUrl } = await readJson(req, Body);
    const { text, minutes } = await transcription.transcribe({ audioUrl });

    await logUsage({
      tenantId: query.tenantId,
      queryId: query.id,
      vendor: "whisper",
      costUsd: whisperCost(minutes),
      tokensOrUnits: Math.round(minutes * 60),
      meta: { minutes },
    });

    const merged = [query.descriptionText, text].filter(Boolean).join("\n").trim();
    await db.query.update({
      where: { id: query.id },
      data: { descriptionText: merged, descriptionAudioUrl: audioUrl },
    });

    return Response.json({ transcript: text, descriptionText: merged, minutes });
  } catch (err) {
    return toErrorResponse(err);
  }
}
