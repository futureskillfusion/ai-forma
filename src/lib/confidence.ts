import type { ConfidenceTier } from "@prisma/client";

/**
 * Derive the appointment confidence tier from how strong and complete the
 * intake is. A high-confidence session earns a shorter designer slot; a vague
 * one gets a longer discovery slot.
 *
 * Signals (dimensions/material/use-case are no longer collected in the widget):
 *  - final self-reported match %      (primary, up to 60)
 *  - description detail               (up to 15)
 *  - customer left contact details    (10)
 *  - converged quickly (≤2 rounds)    (10)
 *  - ranked the concepts              (5)
 */
export function deriveConfidenceTier(input: {
  finalMatchPct: number;
  descriptionLength: number;
  hasContact: boolean;
  roundCount: number;
  rankedConcepts: boolean;
}): { tier: ConfidenceTier; score: number } {
  let score = 0;
  score += Math.min(60, Math.round((input.finalMatchPct / 100) * 60));
  score += input.descriptionLength >= 200 ? 15 : input.descriptionLength >= 80 ? 9 : 3;
  score += input.hasContact ? 10 : 0;
  score += input.roundCount <= 2 ? 10 : input.roundCount <= 3 ? 5 : 0;
  score += input.rankedConcepts ? 5 : 0;

  const tier: ConfidenceTier = score >= 80 ? "high" : score >= 55 ? "standard" : "discovery";
  return { tier, score };
}
