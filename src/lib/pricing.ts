import type { ImageModelTier, UsageVendor } from "@prisma/client";

// Mock per-unit costs (USD). Mirrors the real vendor price sheet closely enough
// for the margin dashboard to be meaningful in development.
export const UNIT_COST: Record<UsageVendor, number> = {
  whisper: 0.006, // per minute of audio
  image_gen: 0.04, // per image, standard tier (see IMAGE_TIER_COST for premium)
  llm: 0.003, // per 1K tokens, blended
  sms: 0.0079, // per message
  email: 0.0009, // per message
};

export const IMAGE_TIER_COST: Record<ImageModelTier, number> = {
  standard: 0.04,
  premium: 0.12,
};

export function imageCost(tier: ImageModelTier, count: number): number {
  return +(IMAGE_TIER_COST[tier] * count).toFixed(4);
}

export function llmCost(tokens: number): number {
  return +((UNIT_COST.llm * tokens) / 1000).toFixed(4);
}

export function whisperCost(minutes: number): number {
  return +(UNIT_COST.whisper * minutes).toFixed(4);
}

export function notifyCost(vendor: "sms" | "email", count = 1): number {
  return +(UNIT_COST[vendor] * count).toFixed(4);
}
