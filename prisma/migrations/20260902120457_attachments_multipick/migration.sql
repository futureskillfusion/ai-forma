-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('reference', 'drawing', 'self_serve');

-- DropForeignKey
ALTER TABLE "HandoffPacket" DROP CONSTRAINT "HandoffPacket_finalVariationId_fkey";

-- AlterTable
ALTER TABLE "HandoffPacket" ALTER COLUMN "finalVariationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "customerNote" TEXT,
ADD COLUMN     "selfServe" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_queryId_idx" ON "Attachment"("queryId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffPacket" ADD CONSTRAINT "HandoffPacket_finalVariationId_fkey" FOREIGN KEY ("finalVariationId") REFERENCES "Variation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
