import type { ConfidenceTier } from "@prisma/client";

/**
 * Derive the appointment confidence tier from the final self-reported match and
 * how completely the customer specified the brief. A high-confidence, well-specified
 * query earns a shorter designer slot; a vague one gets a longer discovery slot.
 */
export function deriveConfidenceTier(input: {
  finalMatchPct: number;
  hasDimensions: boolean;
  hasMaterial: boolean;
  hasUseCase: boolean;
  roundCount: number;
}): { tier: ConfidenceTier; score: number } {
  let score = 0;
  score += Math.min(60, Math.round((input.finalMatchPct / 100) * 60)); // up to 60
  score += input.hasDimensions ? 15 : 0;
  score += input.hasMaterial ? 10 : 0;
  score += input.hasUseCase ? 10 : 0;
  score += input.roundCount <= 2 ? 5 : 0; // converged quickly

  const tier: ConfidenceTier = score >= 80 ? "high" : score >= 55 ? "standard" : "discovery";
  return { tier, score };
}
