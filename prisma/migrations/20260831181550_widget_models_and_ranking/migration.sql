-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "conceptRankingJson" JSONB,
ADD COLUMN     "imageModelChoice" TEXT,
ADD COLUMN     "llmChoice" TEXT;
