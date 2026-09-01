import type { ImageGenAdapter } from "./types";
import { env } from "../env";
import { mockImageGen } from "./mock";

// Hugging Face Inference API — free with a token (huggingface.co/settings/tokens,
// 30-second signup). FLUX.1-schnell is ~2-4s and reliable. Sequential requests,
// with a retry while the model cold-starts (503). Returns ready data URLs.
const MODEL = "black-forest-labs/FLUX.1-schnell";
const ENDPOINT = `https://api-inference.huggingface.co/models/${MODEL}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateOne(prompt: string, seed: number): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.HUGGINGFACE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { seed, width: 768, height: 768 },
        }),
      });
      if (res.status === 503) {
        // Model is loading — HF tells us how long to wait.
        const body = (await res.json().catch(() => ({}))) as { estimated_time?: number };
        await sleep(Math.min(20000, (body.estimated_time ?? 8) * 1000));
        continue;
      }
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const type = res.headers.get("content-type") ?? "image/jpeg";
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const huggingfaceImageGen: ImageGenAdapter = {
  async generate(input) {
    if (!env.HUGGINGFACE_API_TOKEN) return mockImageGen.generate(input);

    const count = Math.min(input.count, 2);
    const seedBase = hash(input.seed ?? input.prompt);
    const fallback = await mockImageGen.generate({ ...input, count });

    const images = [];
    for (let i = 0; i < count; i++) {
      const seed = (seedBase + i * 7919) % 1_000_000;
      const dataUrl = await generateOne(input.prompt, seed);
      images.push({
        url: dataUrl ?? fallback.images[i].url,
        prompt: `${input.prompt} — concept ${i + 1}`,
      });
    }
    return { images, units: count };
  },
};
