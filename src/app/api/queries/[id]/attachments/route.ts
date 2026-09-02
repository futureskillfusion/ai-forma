import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";

// Dev: the client sends a base64 data URL and we store it on the row. In
// production this endpoint should accept multipart, stream to S3/R2, and store
// the object key instead. ~2.6MB binary cap (3.6MB of base64).
const MAX_DATA_URL = 3_600_000;

const Body = z.object({
  kind: z.enum(["reference", "drawing", "self_serve"]),
  dataUrl: z.string().startsWith("data:").max(MAX_DATA_URL),
  mimeType: z.string().max(100),
  label: z.string().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");

    const body = await readJson(req, Body);
    if (!body.mimeType.startsWith("image/")) {
      throw new HttpError(415, "Only image files are supported");
    }

    const count = await db.attachment.count({ where: { queryId: query.id } });
    if (count >= 12) throw new HttpError(429, "Attachment limit reached for this session");

    const att = await db.attachment.create({
      data: {
        queryId: query.id,
        kind: body.kind,
        url: body.dataUrl,
        mimeType: body.mimeType,
        label: body.label,
      },
      select: { id: true, kind: true, mimeType: true, label: true, url: true, createdAt: true },
    });
    return Response.json({ attachment: att }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");
    const attachments = await db.attachment.findMany({
      where: { queryId: query.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, mimeType: true, label: true, url: true, createdAt: true },
    });
    return Response.json({ attachments });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");
    const url = new URL(req.url);
    const attId = url.searchParams.get("attachmentId");
    if (!attId) throw new HttpError(400, "attachmentId is required");
    await db.attachment.deleteMany({ where: { id: attId, queryId: query.id } });
    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
