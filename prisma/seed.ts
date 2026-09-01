import { PrismaClient, type PlanTier } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const hash = (p: string) => bcrypt.hash(p, 10);

// Fixed demo credentials — development only.
const CREDS = {
  superAdmin: { email: "admin@systematicit.io", password: "superadmin123" },
  tenantPassword: "tenant123",
  designerPassword: "designer123",
};

const TIER_DEFAULTS: Record<PlanTier, {
  maxQueriesPerMonth: number;
  maxRegenerationRounds: number;
  imageModelTier: "standard" | "premium";
  designerSeats: number;
  overagePolicy: "hard_cutoff" | "auto_upgrade_prompt" | "metered_billing";
  monthlyCostCapUsd: number;
}> = {
  starter: {
    maxQueriesPerMonth: 150,
    maxRegenerationRounds: 3,
    imageModelTier: "standard",
    designerSeats: 1,
    overagePolicy: "hard_cutoff",
    monthlyCostCapUsd: 120,
  },
  pro: {
    maxQueriesPerMonth: 500,
    maxRegenerationRounds: 5,
    imageModelTier: "premium",
    designerSeats: 5,
    overagePolicy: "auto_upgrade_prompt",
    monthlyCostCapUsd: 380,
  },
  enterprise: {
    maxQueriesPerMonth: 5000,
    maxRegenerationRounds: 8,
    imageModelTier: "premium",
    designerSeats: 50,
    overagePolicy: "metered_billing",
    monthlyCostCapUsd: 2000,
  },
};

function placeholder(seed: string, variant: number): string {
  const palette = [
    ["#2563EB", "#DBEAFE"],
    ["#EA580C", "#FFEDD5"],
    ["#059669", "#D1FAE5"],
  ];
  const [fg, bg] = palette[(seed.length + variant) % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${bg}"/><circle cx="320" cy="300" r="${130 + variant * 20}" fill="${fg}" opacity="0.9"/><text x="320" y="560" font-family="sans-serif" font-size="22" font-weight="700" fill="${fg}" text-anchor="middle">Variation ${variant + 1}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function main() {
  console.log("Seeding AI Forma…");

  await db.platformConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", killSwitchEnabled: false },
    update: {},
  });

  const superAdmin = await db.superAdmin.upsert({
    where: { email: CREDS.superAdmin.email },
    create: {
      email: CREDS.superAdmin.email,
      name: "Platform Owner",
      passwordHash: await hash(CREDS.superAdmin.password),
    },
    update: {},
  });

  for (const tier of Object.keys(TIER_DEFAULTS) as PlanTier[]) {
    const existing = await db.planLimit.findFirst({ where: { tenantId: null, planTier: tier } });
    if (!existing) {
      await db.planLimit.create({ data: { tenantId: null, planTier: tier, ...TIER_DEFAULTS[tier] } });
    }
  }

  // ── Tenant A: 3D-2U — active, Pro, with a full completed journey ───────────
  const a = await db.tenant.upsert({
    where: { slug: "3d-2u" },
    update: {},
    create: {
      name: "3D-2U",
      slug: "3d-2u",
      planTier: "pro",
      retainerAmount: "1200.00",
      status: "active",
      subscriptionStatus: "active",
      embedKey: "fk_demo_3d2u_public_key_01",
      embedAllowedOrigins: ["https://3d-2u.com"],
      primaryColor: "#2563EB",
      currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      users: {
        create: [
          { role: "tenant_admin", name: "Owen Diaz", email: "owner@3d-2u.com", passwordHash: await hash(CREDS.tenantPassword) },
          { role: "designer", name: "Maya Chen", email: "maya@3d-2u.com", passwordHash: await hash(CREDS.designerPassword) },
          { role: "designer", name: "Raj Patel", email: "raj@3d-2u.com", passwordHash: await hash(CREDS.designerPassword) },
        ],
      },
    },
    include: { users: true },
  });
  const mayaId = a.users.find((u) => u.email === "maya@3d-2u.com")!.id;

  const aQueryCount = await db.query.count({ where: { tenantId: a.id } });
  if (aQueryCount === 0) {
    // Completed journey: crescent-moon planter, 2 rounds, handed off + booked.
    const q1 = await db.query.create({
      data: {
        tenantId: a.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
        customerName: "Priya Sharma",
        customerEmail: "priya@example.com",
        customerPhone: "+1 555 0148",
        descriptionText:
          "A wall-mounted planter shaped like a crescent moon, matte white finish, holds one small succulent, mounts with two hidden screws.",
        llmChoice: "claude-sonnet",
        imageModelChoice: "flux-pro",
        status: "booked",
        matchThreshold: 80,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
      },
    });

    const r1 = await Promise.all(
      [0, 1, 2].map((i) =>
        db.variation.create({
          data: {
            queryId: q1.id,
            roundNumber: 1,
            imageUrl: placeholder("moon", i),
            generationPrompt: "crescent moon wall planter, matte white PLA — pass " + (i + 1),
            feasibilityFlag: i === 2,
            feasibilityNotes: i === 2 ? "Tips of the crescent are thin — thicken to >2mm before printing." : null,
          },
        }),
      ),
    );
    await db.rating.create({
      data: {
        variationId: r1[0].id,
        overallMatchPct: 62,
        shapeScore: "good",
        sizeScore: "too_big",
        materialScore: "close",
        changeRequestText: "Make the base narrower and the crescent curve deeper.",
      },
    });

    const r2 = await Promise.all(
      [0, 1, 2].map((i) =>
        db.variation.create({
          data: {
            queryId: q1.id,
            roundNumber: 2,
            imageUrl: placeholder("moon2", i),
            generationPrompt: "deeper crescent curve, narrower base — pass " + (i + 1),
            feasibilityFlag: false,
          },
        }),
      ),
    );
    const finalVar = r2[1];
    await db.rating.create({
      data: {
        variationId: finalVar.id,
        overallMatchPct: 88,
        shapeScore: "good",
        sizeScore: "good",
        materialScore: "good",
        changeRequestText: null,
      },
    });

    const packet = await db.handoffPacket.create({
      data: {
        queryId: q1.id,
        finalVariationId: finalVar.id,
        summaryText:
          "Customer wants a wall-mounted crescent-moon planter in matte white PLA, ~20×15×8cm, for a single indoor succulent. " +
          "Refined over 2 rounds: base narrowed and crescent curve deepened. Final match 88%. Brief is tight — a short confirmation session should be enough to move to modelling.",
        requirementHistoryJson: {
          description: q1.descriptionText,
          dimensions: q1.dimensions,
          material: q1.materialPreference,
          useCase: q1.useCase,
          confidenceTier: "high",
          finalMatchPct: 88,
          rounds: [
            { round: 1, overallMatchPct: 62, changeRequest: "Narrower base, deeper curve" },
            { round: 2, overallMatchPct: 88, changeRequest: null },
          ],
        },
        assignedDesignerId: mayaId,
        appointment: {
          create: {
            designerId: mayaId,
            scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
            durationMinutes: 20,
            externalCalendarEventId: "evt_mock_seed_01",
            confidenceTier: "high",
          },
        },
      },
    });

    // In-progress queries for the tenant dashboard.
    await db.query.create({
      data: {
        tenantId: a.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(Date.now() - 1000 * 60 * 90),
        customerName: "Tom Reeves",
        descriptionText: "Hexagonal desk organiser with three compartments and a phone slot.",
        dimensions: "18cm x 10cm x 9cm",
        materialPreference: "PETG, charcoal",
        status: "rating",
        createdAt: new Date(Date.now() - 1000 * 60 * 90),
        variations: {
          create: [0, 1, 2].map((i) => ({
            roundNumber: 1,
            imageUrl: placeholder("hex", i),
            generationPrompt: "hex desk organiser — pass " + (i + 1),
          })),
        },
      },
    });
    await db.query.create({
      data: {
        tenantId: a.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(Date.now() - 1000 * 60 * 20),
        descriptionText: "Replacement knob for a vintage radio, splined shaft.",
        status: "describing",
        createdAt: new Date(Date.now() - 1000 * 60 * 20),
      },
    });
    await db.query.create({
      data: {
        tenantId: a.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
        descriptionText: "Articulated dragon keychain, ~6cm, moving joints.",
        status: "escalated",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    });

    // Usage rows — the completed journey plus backfill so the margin dashboard is alive.
    const usageSeed = [
      { vendor: "image_gen" as const, costUsd: "0.3600", tokensOrUnits: 3, queryId: q1.id },
      { vendor: "image_gen" as const, costUsd: "0.3600", tokensOrUnits: 3, queryId: q1.id },
      { vendor: "llm" as const, costUsd: "0.0013", tokensOrUnits: 420, queryId: q1.id },
      { vendor: "llm" as const, costUsd: "0.0031", tokensOrUnits: 1040, queryId: q1.id },
      { vendor: "email" as const, costUsd: "0.0009", tokensOrUnits: 1, queryId: q1.id },
    ];
    for (const u of usageSeed) {
      await db.usageLog.create({ data: { tenantId: a.id, ...u } });
    }
    for (let i = 0; i < 40; i++) {
      await db.usageLog.create({
        data: {
          tenantId: a.id,
          vendor: i % 3 === 0 ? "llm" : "image_gen",
          costUsd: i % 3 === 0 ? "0.0028" : "0.1200",
          tokensOrUnits: i % 3 === 0 ? 950 : 1,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * (i * 3)),
        },
      });
    }
  }

  // ── Tenant B: Nova Prototypes — active, Starter, minimal data ──────────────
  const b = await db.tenant.upsert({
    where: { slug: "nova" },
    update: {},
    create: {
      name: "Nova Prototypes",
      slug: "nova",
      planTier: "starter",
      retainerAmount: "450.00",
      status: "active",
      subscriptionStatus: "active",
      embedKey: "fk_demo_nova_public_key_02",
      embedAllowedOrigins: ["https://novaprototypes.io"],
      users: {
        create: [
          { role: "tenant_admin", name: "Nadia Ford", email: "admin@nova.test", passwordHash: await hash(CREDS.tenantPassword) },
          { role: "designer", name: "Sam Okafor", email: "sam@nova.test", passwordHash: await hash(CREDS.designerPassword) },
        ],
      },
    },
  });
  if ((await db.query.count({ where: { tenantId: b.id } })) === 0) {
    await db.query.create({
      data: {
        tenantId: b.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(),
        descriptionText: "Custom cable clip that mounts under a desk with 3M tape.",
        status: "describing",
      },
    });
    await db.usageLog.create({
      data: { tenantId: b.id, vendor: "image_gen", costUsd: "0.1200", tokensOrUnits: 3 },
    });
  }

  // ── Tenant C: Legacy Cast — suspended, to demo the disabled widget ─────────
  await db.tenant.upsert({
    where: { slug: "legacy-cast" },
    update: {},
    create: {
      name: "Legacy Cast",
      slug: "legacy-cast",
      planTier: "starter",
      retainerAmount: "450.00",
      status: "suspended",
      subscriptionStatus: "past_due",
      embedKey: "fk_demo_legacy_public_key_03",
      users: {
        create: [
          { role: "tenant_admin", name: "Cal Whitmore", email: "admin@legacycast.test", passwordHash: await hash(CREDS.tenantPassword) },
        ],
      },
    },
  });

  // ── Access requests — prospective tenants awaiting review ──────────────────
  if ((await db.accessRequest.count()) === 0) {
    await db.accessRequest.createMany({
      data: [
        {
          businessName: "Vireo Additive",
          contactName: "Hannah Boyd",
          email: "hannah@vireoadditive.com",
          phone: "+1 415 555 0142",
          website: "https://vireoadditive.com",
          expectedMonthlyQueries: 320,
          message: "We do custom SLA parts for medical device startups and get a lot of vague briefs.",
        },
        {
          businessName: "Bramble & Bolt",
          contactName: "Marco Iyer",
          email: "marco@brambleandbolt.co",
          website: "https://brambleandbolt.co",
          expectedMonthlyQueries: 90,
          message: "Small studio, mostly homeware. Want customers to visualise before booking a call.",
        },
      ],
    });
  }

  console.log("\nSeed complete.\n");
  console.table({
    "Super admin console": `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin  ·  ${CREDS.superAdmin.email} / ${CREDS.superAdmin.password}`,
    "Tenant admin (3D-2U)": `/app  ·  owner@3d-2u.com / ${CREDS.tenantPassword}`,
    "Tenant admin (Nova)": `/app  ·  admin@nova.test / ${CREDS.tenantPassword}`,
    "Customer widget (active)": `/w/fk_demo_3d2u_public_key_01`,
    "Customer widget (suspended)": `/w/fk_demo_legacy_public_key_03`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
