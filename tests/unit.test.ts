import { describe, expect, it } from "vitest";
import { deriveConfidenceTier } from "@/lib/confidence";
import { imageCost, llmCost, whisperCost } from "@/lib/pricing";
import { slugify } from "@/lib/slug";

describe("deriveConfidenceTier", () => {
  it("gives a high tier for a strong, fully-specified brief", () => {
    const { tier } = deriveConfidenceTier({
      finalMatchPct: 92,
      hasDimensions: true,
      hasMaterial: true,
      hasUseCase: true,
      roundCount: 2,
    });
    expect(tier).toBe("high");
  });

  it("gives a discovery tier for a vague, low-match brief", () => {
    const { tier } = deriveConfidenceTier({
      finalMatchPct: 55,
      hasDimensions: false,
      hasMaterial: false,
      hasUseCase: false,
      roundCount: 5,
    });
    expect(tier).toBe("discovery");
  });

  it("lands on standard in between", () => {
    const { tier } = deriveConfidenceTier({
      finalMatchPct: 80,
      hasDimensions: true,
      hasMaterial: false,
      hasUseCase: false,
      roundCount: 3,
    });
    expect(tier).toBe("standard");
  });
});

describe("pricing", () => {
  it("charges premium image tier more than standard", () => {
    expect(imageCost("premium", 3)).toBeGreaterThan(imageCost("standard", 3));
  });
  it("scales llm cost with tokens", () => {
    expect(llmCost(2000)).toBeCloseTo(llmCost(1000) * 2, 5);
  });
  it("scales whisper cost with minutes", () => {
    expect(whisperCost(4)).toBeCloseTo(whisperCost(1) * 4, 5);
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("3D-2U Prototyping!")).toBe("3d-2u-prototyping");
  });
});
