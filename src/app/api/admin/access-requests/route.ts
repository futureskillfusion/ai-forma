import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse } from "@/lib/rbac";

export async function GET() {
  try {
    await apiRequireSuperAdmin();
    const requests = await db.accessRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return Response.json({
      requests,
      pendingCount: requests.filter((r) => r.status === "pending").length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
