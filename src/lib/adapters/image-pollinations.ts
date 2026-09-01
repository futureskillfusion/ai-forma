import type { ImageGenAdapter } from "./types";
import { mockImageGen } from "./mock";

// Free, key-less image generation via Pollinations (https://pollinations.ai).
// The customer's model pick maps to the closest free model; the label they chose
// is preserved on the brief elsewhere. Swap this file for a paid provider later.
const POLLINATIONS_MODEL: Record<string, string> = {
  "flux-pro": "flux",
  "dall-e-3": "flux",
  "gpt-image-1": "flux",
  "imagen-3": "flux-realism",
  "midjourney-v6": "flux",
  "sd-3-5-large": "turbo",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildUrl(prompt: string, model: string, seed: number): string {
  const p = encodeURIComponent(prompt.slice(0, 380));
  const params = new URLSearchParams({
    width: "768",
    height: "768",
    seed: String(seed),
    model,
    nologo: "true",
  });
  return `https://image.pollinations.ai/prompt/${p}?${params.toString()}`;
}

export const pollinationsImageGen: ImageGenAdapter = {
  async generate(input) {
    const model = POLLINATIONS_MODEL[input.model ?? ""] ?? "flux";
    const seedBase = hash(input.seed ?? input.prompt);

    const images = Array.from({ length: input.count }, (_, i) => {
      const seed = (seedBase + i * 7919) % 2_000_000;
      return {
        url: buildUrl(input.prompt, model, seed),
        prompt: `${input.prompt} — ${model} #${i + 1}`,
      };
    });

    // Quick liveness probe (HEAD, short timeout). If Pollinations is clearly
    // unreachable, fall back to offline placeholders; otherwise return the URLs
    // and let the browser stream the images in (the widget dims any that fail).
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const res = await fetch("https://image.pollinations.ai/", {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok && res.status >= 500) throw new Error(`pollinations ${res.status}`);
    } catch {
      return mockImageGen.generate(input);
    }

    return { images, units: input.count };
  },
};
