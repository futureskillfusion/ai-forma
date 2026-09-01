import { PageHeader } from "@/components/shell";
import { db } from "@/lib/db";
import { RequestsList } from "./requests-list";

export const metadata = { title: "Access requests" };
export const dynamic = "force-dynamic";

export default async function AccessRequestsPage() {
  const requests = await db.accessRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Access requests"
        description="Businesses that asked for an AI Forma account. Approving one provisions the tenant, its first admin, and an embed key."
      />
      <RequestsList
        initial={requests.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
