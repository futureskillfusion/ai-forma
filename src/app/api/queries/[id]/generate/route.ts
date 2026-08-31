import { db } from "@/lib/db";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery, generateRound } from "@/lib/intake";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(_req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");
    if (query.descriptionText.trim().length < 8) {
      throw new HttpError(400, "Add a short description of your idea first");
    }

    const result = await generateRound(query);
    return Response.json({
      round: result.round,
      maxRounds: result.maxRounds,
      variations: result.variations.map((v) => ({
        id: v.id,
        roundNumber: v.roundNumber,
        imageUrl: v.imageUrl,
        feasibilityFlag: v.feasibilityFlag,
        feasibilityNotes: v.feasibilityNotes,
      })),
    });
  } catch (err) {
    if (err instanceof HttpError && err.message === "MAX_ROUNDS_REACHED") {
      const { id } = await params;
      const packetQuery = await db.query.findUnique({ where: { id } });
      return Response.json(
        {
          error: "You've used all available generation rounds — a designer will take it from here.",
          escalated: true,
          status: packetQuery?.status,
        },
        { status: 409 },
      );
    }
    return toErrorResponse(err);
  }
}
