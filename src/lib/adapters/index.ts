import { env } from "../env";
import {
  mockBilling,
  mockBooking,
  mockImageGen,
  mockLlm,
  mockNotify,
  mockTranscription,
} from "./mock";
import type {
  BillingAdapter,
  BookingAdapter,
  ImageGenAdapter,
  LlmAdapter,
  NotifyAdapter,
  TranscriptionAdapter,
} from "./types";

// Real adapters are not wired yet. When USE_MOCK_ADAPTERS=false, calls throw a
// clear "not configured" error rather than failing silently — swap in real
// implementations here (Flux/GPT Image, Whisper, Claude, Stripe, Calendly).
function notConfigured(name: string): never {
  throw new Error(
    `Real "${name}" adapter is not configured. Set USE_MOCK_ADAPTERS=true or implement it in src/lib/adapters/.`,
  );
}

const realStub = new Proxy(
  {},
  { get: (_t, prop) => () => notConfigured(String(prop)) },
) as never;

const useMock = env.USE_MOCK_ADAPTERS;

export const imageGen: ImageGenAdapter = useMock ? mockImageGen : realStub;
export const transcription: TranscriptionAdapter = useMock ? mockTranscription : realStub;
export const llm: LlmAdapter = useMock ? mockLlm : realStub;
export const billing: BillingAdapter = useMock ? mockBilling : realStub;
export const booking: BookingAdapter = useMock ? mockBooking : realStub;
export const notify: NotifyAdapter = useMock ? mockNotify : realStub;

export const ADAPTER_MODE = useMock ? "mock" : "real";
