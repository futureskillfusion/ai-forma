import type { ImageModelTier } from "@prisma/client";

export interface GeneratedImage {
  url: string;
  prompt: string;
}

export interface ImageGenAdapter {
  generate(input: {
    prompt: string;
    count: number;
    tier: ImageModelTier;
    seed?: string;
  }): Promise<{ images: GeneratedImage[]; units: number }>;
}

export interface TranscriptionAdapter {
  transcribe(input: { audioUrl: string }): Promise<{ text: string; minutes: number }>;
}

export interface LlmAdapter {
  feasibilityCheck(input: {
    description: string;
    dimensions?: string | null;
    material?: string | null;
  }): Promise<{ flagged: boolean; notes: string | null; tokens: number }>;

  compileHandoff(input: {
    description: string;
    dimensions?: string | null;
    material?: string | null;
    useCase?: string | null;
    rounds: Array<{
      round: number;
      overallMatchPct: number | null;
      changeRequest: string | null;
    }>;
    finalMatchPct: number;
  }): Promise<{ summaryText: string; tokens: number }>;
}

export type BillingSubStatus = "trialing" | "active" | "past_due" | "canceled";

export interface BillingAdapter {
  createSubscription(input: {
    tenantId: string;
    tenantName: string;
    planTier: string;
    retainerAmount: number;
  }): Promise<{ subscriptionId: string; status: BillingSubStatus; currentPeriodEnd: Date }>;

  cancelSubscription(input: { subscriptionId: string }): Promise<{ status: BillingSubStatus }>;
}

export interface BookingSlot {
  start: string; // ISO
  durationMinutes: number;
}

export interface BookingAdapter {
  getSlots(input: {
    designerId: string;
    confidenceTier: "high" | "standard" | "discovery";
  }): Promise<{ slots: BookingSlot[]; durationMinutes: number }>;

  book(input: {
    designerId: string;
    start: string;
    durationMinutes: number;
  }): Promise<{ externalCalendarEventId: string }>;
}

export interface NotifyAdapter {
  send(input: {
    channel: "sms" | "email";
    to: string;
    template: string;
    data: Record<string, unknown>;
  }): Promise<{ id: string }>;
}
