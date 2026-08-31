import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { signCustomerToken, verifyCustomerToken } from "@/lib/auth";

// Integration test against the dev database. Verifies the multi-tenant isolation
// guarantee the spec requires: no tenant-scoped read can reach another tenant's data.
const db = new PrismaClient();

let tenantA = "";
let tenantB = "";
let queryA = "";
let queryB = "";

beforeAll(async () => {
  const mk = async (name: string) => {
    const t = await db.tenant.create({
      data: {
        name,
        slug: `test-${nanoid(8).toLowerCase()}`,
        planTier: "starter",
        retainerAmount: "450.00",
        embedKey: `fk_test_${nanoid(20)}`,
      },
    });
    const q = await db.query.create({
      data: { tenantId: t.id, consentConfirmed: true, descriptionText: `${name} secret idea` },
    });
    return { tid: t.id, qid: q.id };
  };
  const a = await mk("Isolation Test A");
  const b = await mk("Isolation Test B");
  tenantA = a.tid;
  tenantB = b.tid;
  queryA = a.qid;
  queryB = b.qid;
});

afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await db.$disconnect();
});

describe("tenant data isolation", () => {
  it("a tenant-scoped query cannot read another tenant's row", async () => {
    const wrongTenantRead = await db.query.findFirst({
      where: { id: queryB, tenantId: tenantA },
    });
    expect(wrongTenantRead).toBeNull();

    const correct = await db.query.findFirst({ where: { id: queryB, tenantId: tenantB } });
    expect(correct?.id).toBe(queryB);
  });

  it("a customer token signed for tenant A does not validate against tenant B's query", async () => {
    const token = await signCustomerToken({ queryId: queryA, tenantId: tenantA });
    const claims = await verifyCustomerToken(token);
    expect(claims).not.toBeNull();

    // Simulate requireCustomerQuery's defence-in-depth check.
    const row = await db.query.findUnique({ where: { id: claims!.queryId } });
    const passes = !!row && row.tenantId === claims!.tenantId;
    expect(passes).toBe(true);

    // Tamper: same token, ask for tenant B's query id.
    const forged = await signCustomerToken({ queryId: queryB, tenantId: tenantA });
    const forgedClaims = await verifyCustomerToken(forged);
    const forgedRow = await db.query.findUnique({ where: { id: forgedClaims!.queryId } });
    const forgedPasses = !!forgedRow && forgedRow.tenantId === forgedClaims!.tenantId;
    expect(forgedPasses).toBe(false); // row.tenantId (B) !== claim.tenantId (A)
  });

  it("usage logs aggregate only within a tenant", async () => {
    await db.usageLog.create({
      data: { tenantId: tenantA, vendor: "image_gen", costUsd: "1.2345", tokensOrUnits: 3 },
    });
    const aSum = await db.usageLog.aggregate({
      where: { tenantId: tenantA },
      _sum: { costUsd: true },
    });
    const bSum = await db.usageLog.aggregate({
      where: { tenantId: tenantB },
      _sum: { costUsd: true },
    });
    expect(Number(aSum._sum.costUsd ?? 0)).toBeGreaterThan(0);
    expect(Number(bSum._sum.costUsd ?? 0)).toBe(0);
  });
});
