import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";

// Public endpoint — a prospective manufacturer asks for an account.
const Body = z.object({
  businessName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  expectedMonthlyQueries: z.number().int().min(0).max(1_000_000).optional(),
  message: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await readJson(req, Body);
    const email = body.email.toLowerCase();

    // Light anti-dupe: block a second pending request from the same email.
    const existingPending = await db.accessRequest.findFirst({
      where: { email, status: "pending" },
    });
    if (existingPending) {
      throw new HttpError(409, "We already have a pending request from this email — we'll be in touch soon.");
    }

    await db.accessRequest.create({
      data: {
        businessName: body.businessName.trim(),
        contactName: body.contactName.trim(),
        email,
        phone: body.phone || null,
        website: body.website || null,
        expectedMonthlyQueries: body.expectedMonthlyQueries ?? null,
        message: body.message || null,
      },
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
