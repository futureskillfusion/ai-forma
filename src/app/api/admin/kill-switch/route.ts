import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { getPlatformConfig, writeAudit } from "@/lib/platform";

const Body = z.object({ enabled: z.boolean(), reason: z.string().max(500).optional() });

export async function GET() {
  try {
    await apiRequireSuperAdmin();
    const cfg = await getPlatformConfig();
    return Response.json({ enabled: cfg.killSwitchEnabled, updatedAt: cfg.updatedAt });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await apiRequireSuperAdmin();
    const { enabled, reason } = await readJson(req, Body);
    await getPlatformConfig();
    const cfg = await db.platformConfig.update({
      where: { id: "singleton" },
      data: { killSwitchEnabled: enabled, updatedBy: admin.email },
    });
    await writeAudit({
      actorId: admin.sub,
      action: "kill_switch_toggled",
      metadata: { enabled },
      reason,
    });
    return Response.json({ enabled: cfg.killSwitchEnabled });
  } catch (err) {
    return toErrorResponse(err);
  }
}
