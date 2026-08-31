-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'over_cap', 'past_due', 'suspended');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('tenant_admin', 'designer');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('describing', 'generating', 'rating', 'handed_off', 'booked', 'escalated');

-- CreateEnum
CREATE TYPE "ShapeScore" AS ENUM ('off', 'good', 'close');

-- CreateEnum
CREATE TYPE "SizeScore" AS ENUM ('too_big', 'good', 'too_small');

-- CreateEnum
CREATE TYPE "MaterialScore" AS ENUM ('off', 'good', 'close');

-- CreateEnum
CREATE TYPE "ConfidenceTier" AS ENUM ('high', 'standard', 'discovery');

-- CreateEnum
CREATE TYPE "UsageVendor" AS ENUM ('whisper', 'image_gen', 'llm', 'sms', 'email');

-- CreateEnum
CREATE TYPE "ImageModelTier" AS ENUM ('standard', 'premium');

-- CreateEnum
CREATE TYPE "OveragePolicy" AS ENUM ('hard_cutoff', 'auto_upgrade_prompt', 'metered_billing');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('transcription', 'image_generation', 'handoff_compilation');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "NdaStatus" AS ENUM ('requested', 'sent', 'signed', 'declined');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('tenant_created', 'tenant_suspended', 'tenant_reactivated', 'plan_limits_updated', 'kill_switch_toggled', 'subscription_status_changed');

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "killSwitchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetTenant" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL DEFAULT 'starter',
    "retainerAmount" DECIMAL(10,2) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "embedKey" TEXT NOT NULL,
    "embedAllowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563EB',
    "subdomain" TEXT,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "calendarConnectionId" TEXT,
    "availabilityJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLimit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "planTier" "PlanTier" NOT NULL,
    "maxQueriesPerMonth" INTEGER NOT NULL,
    "maxRegenerationRounds" INTEGER NOT NULL,
    "imageModelTier" "ImageModelTier" NOT NULL DEFAULT 'standard',
    "designerSeats" INTEGER NOT NULL,
    "overagePolicy" "OveragePolicy" NOT NULL DEFAULT 'hard_cutoff',
    "monthlyCostCapUsd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PlanLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Query" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmedAt" TIMESTAMP(3),
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "descriptionText" TEXT NOT NULL DEFAULT '',
    "descriptionAudioUrl" TEXT,
    "dimensions" TEXT,
    "materialPreference" TEXT,
    "useCase" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'describing',
    "matchThreshold" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Query_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "generationPrompt" TEXT NOT NULL,
    "feasibilityFlag" BOOLEAN NOT NULL DEFAULT false,
    "feasibilityNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "overallMatchPct" INTEGER NOT NULL,
    "shapeScore" "ShapeScore" NOT NULL,
    "sizeScore" "SizeScore" NOT NULL,
    "materialScore" "MaterialScore" NOT NULL,
    "annotationData" JSONB,
    "changeRequestText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffPacket" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "finalVariationId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "requirementHistoryJson" JSONB NOT NULL,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedDesignerId" TEXT,

    CONSTRAINT "HandoffPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "handoffPacketId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "externalCalendarEventId" TEXT,
    "confidenceTier" "ConfidenceTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "resultJson" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdaRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "status" "NdaStatus" NOT NULL DEFAULT 'requested',
    "requesterEmail" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NdaRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "queryId" TEXT,
    "vendor" "UsageVendor" NOT NULL,
    "costUsd" DECIMAL(10,4) NOT NULL,
    "tokensOrUnits" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "AuditLog_targetTenant_idx" ON "AuditLog"("targetTenant");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_embedKey_key" ON "Tenant"("embedKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "TenantUser_tenantId_idx" ON "TenantUser"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_tenantId_email_key" ON "TenantUser"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLimit_tenantId_key" ON "PlanLimit"("tenantId");

-- CreateIndex
CREATE INDEX "PlanLimit_planTier_idx" ON "PlanLimit"("planTier");

-- CreateIndex
CREATE INDEX "Query_tenantId_status_idx" ON "Query"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Query_tenantId_createdAt_idx" ON "Query"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Variation_queryId_roundNumber_idx" ON "Variation"("queryId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_variationId_key" ON "Rating"("variationId");

-- CreateIndex
CREATE UNIQUE INDEX "HandoffPacket_queryId_key" ON "HandoffPacket"("queryId");

-- CreateIndex
CREATE UNIQUE INDEX "HandoffPacket_finalVariationId_key" ON "HandoffPacket"("finalVariationId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_handoffPacketId_key" ON "Appointment"("handoffPacketId");

-- CreateIndex
CREATE INDEX "Job_queryId_type_idx" ON "Job"("queryId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "NdaRequest_queryId_key" ON "NdaRequest"("queryId");

-- CreateIndex
CREATE INDEX "NdaRequest_tenantId_status_idx" ON "NdaRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "UsageLog_tenantId_createdAt_idx" ON "UsageLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "SuperAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLimit" ADD CONSTRAINT "PlanLimit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Query" ADD CONSTRAINT "Query_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "Variation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffPacket" ADD CONSTRAINT "HandoffPacket_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffPacket" ADD CONSTRAINT "HandoffPacket_finalVariationId_fkey" FOREIGN KEY ("finalVariationId") REFERENCES "Variation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffPacket" ADD CONSTRAINT "HandoffPacket_assignedDesignerId_fkey" FOREIGN KEY ("assignedDesignerId") REFERENCES "TenantUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_handoffPacketId_fkey" FOREIGN KEY ("handoffPacketId") REFERENCES "HandoffPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "TenantUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdaRequest" ADD CONSTRAINT "NdaRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdaRequest" ADD CONSTRAINT "NdaRequest_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "Query"("id") ON DELETE SET NULL ON UPDATE CASCADE;
