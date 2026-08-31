import "server-only";
import type { AuditAction } from "@prisma/client";
import { db } from "./db";

/** Read (and lazily create) the singleton platform config row. */
export async function getPlatformConfig() {
  return db.platformConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function isKillSwitchOn(): Promise<boolean> {
  const cfg = await getPlatformConfig();
  return cfg.killSwitchEnabled;
}

/** Guard placed in front of every image-generation and transcription call. */
export async function assertAiEnabled() {
  if (await isKillSwitchOn()) {
    throw new Error("AI_KILL_SWITCH_ON");
  }
}

export async function writeAudit(input: {
  actorId: string;
  action: AuditAction;
  targetTenant?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetTenant: input.targetTenant,
      reason: input.reason,
      metadata: input.metadata as never,
    },
  });
}
