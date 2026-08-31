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

// Per-image price by the customer-selected model (USD). Falls back to the plan
// tier price when the model is unknown.
export const IMAGE_MODEL_COST: Record<string, number> = {
  "flux-pro": 0.055,
  "dall-e-3": 0.08,
  "imagen-3": 0.06,
  "midjourney-v6": 0.1,
  "sd-3-5-large": 0.035,
  "gpt-image-1": 0.07,
};

// Per-1K-token blended price by the customer-selected LLM (USD).
export const LLM_MODEL_COST_PER_1K: Record<string, number> = {
  "claude-opus": 0.012,
  "claude-sonnet": 0.003,
  "gpt-4o": 0.005,
  "gemini-1-5-pro": 0.0035,
  "llama-3-1-70b": 0.0009,
};

export function imageCost(
  tier: ImageModelTier,
  count: number,
  model?: string | null,
): number {
  const unit = (model && IMAGE_MODEL_COST[model]) || IMAGE_TIER_COST[tier];
  return +(unit * count).toFixed(4);
}

export function llmCost(tokens: number, model?: string | null): number {
  const per1k = (model && LLM_MODEL_COST_PER_1K[model]) || UNIT_COST.llm;
  return +((per1k * tokens) / 1000).toFixed(4);
}

export function whisperCost(minutes: number): number {
  return +(UNIT_COST.whisper * minutes).toFixed(4);
}

export function notifyCost(vendor: "sms" | "email", count = 1): number {
  return +(UNIT_COST[vendor] * count).toFixed(4);
}
