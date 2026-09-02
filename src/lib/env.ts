// Centralised, validated environment access. Import from here, never read
// process.env directly in feature code.
import { z } from "zod";

// Treat an empty-string env var (common on hosts where you "add" a key but
// leave the value blank) the same as unset, so `.default()` can apply.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optUrl = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().url().default(fallback));
const optEnum = <T extends [string, ...string[]]>(vals: T, fallback: T[number]) =>
  z.preprocess(emptyToUndefined, z.enum(vals).default(fallback));

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: optUrl("http://localhost:3000"),
  USE_MOCK_ADAPTERS: optEnum(["true", "false"], "true").transform((v) => v === "true"),
  // Image generation provider:
  //  - "huggingface" = free with a token (reliable FLUX.1-schnell) — set HUGGINGFACE_API_TOKEN
  //  - "pollinations" = free, no key (best-effort; often rate-limited)
  //  - "mock" = offline placeholder
  IMAGE_PROVIDER: optEnum(["huggingface", "pollinations", "mock"], "pollinations"),
  HUGGINGFACE_API_TOKEN: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — see logs above.");
}

export const env = parsed.data;
