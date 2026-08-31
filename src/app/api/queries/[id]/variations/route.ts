import { db } from "@/lib/db";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");

    const variations = await db.variation.findMany({
      where: { queryId: query.id },
      orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
      include: { rating: true },
    });
    return Response.json({
      status: query.status,
      matchThreshold: query.matchThreshold,
      variations: variations.map((v) => ({
        id: v.id,
        roundNumber: v.roundNumber,
        imageUrl: v.imageUrl,
        feasibilityFlag: v.feasibilityFlag,
        feasibilityNotes: v.feasibilityNotes,
        rating: v.rating
          ? { overallMatchPct: v.rating.overallMatchPct, changeRequestText: v.rating.changeRequestText }
          : null,
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
