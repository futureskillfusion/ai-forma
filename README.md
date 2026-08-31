# Forma Intake

AI-guided customer design intake for 3D-printing / manufacturing businesses.
Multi-tenant SaaS operated by **Systematic IT Solutions** (platform owner), licensed
to manufacturers ("tenants") who embed the intake widget on their own website.

> This repo is a **full-stack vertical slice**: the complete `provision → intake →
> handoff → cost` path works end to end. External vendors (image gen, voice, LLM,
> Stripe, Calendly, Twilio, SendGrid) run through **mock adapters** — no API keys
> needed to run it.

---

## What works today

| Area | Included |
|---|---|
| **Super admin console** (`/admin`) | Separate hardened login · tenant list with live cost-vs-retainer margin · create tenant (account + first admin + subscription + embed key) · suspend / reactivate · per-tenant plan-limit / feature-flag overrides · platform usage & margin · global AI kill switch · audit log |
| **Tenant dashboard** (`/app`) | Login (admins + designers) · quota / spend / plan card · copyable embed snippet · customer queries list + full detail (every round, ratings, feasibility notes, handoff packet, appointment) · designer roster with seat enforcement · branding (colour + logo) · suspended tenants see only a billing notice |
| **Customer widget** (`/w/<embedKey>`) | Consent gate · describe (text; voice endpoint stubbed) · AI image rounds (2–3 / round) · per-image printability check · rate (match % + shape/size/material + change request) · loop within the plan's round cap, else escalate to a human · LLM-compiled handoff packet · confidence-tiered appointment booking · respects tenant status + kill switch |
| **Enforcement** | `tenantId` derived from session/embed key on every scoped query (never client-supplied) · per-query customer bearer tokens · plan query-cap + regen-cap · kill switch blocks all image/voice calls · every billable call writes a `UsageLog` row |

## Stack

- **Next.js 16** (App Router) — one codebase for all three UIs + API route handlers
- **PostgreSQL + Prisma**
- **Auth** — signed JWT session cookies (`jose`), separate cookie domains for super admin vs tenant users, short-lived per-query tokens for the widget
- **Tailwind CSS v4** — design tokens from the `ui-ux-pro-max` skill (Plus Jakarta Sans, trust-blue `#2563EB` + orange CTA, light-first, glass accents on the widget)
- Mock vendor adapters in `src/lib/adapters/` — swap real implementations behind the same interfaces

## Getting started

Prerequisites: Node 20+, Docker (for Postgres).

```bash
npm install
cp .env.example .env          # defaults work as-is for local dev
npm run db:up                 # start Postgres (docker compose, port 5434)
npm run db:migrate            # apply schema
npm run db:seed               # demo tenants + a completed journey
npm run dev
```

Open http://localhost:3000.

### Demo logins

| Surface | URL | Credentials |
|---|---|---|
| Platform admin | `/admin` | `admin@systematicit.io` / `superadmin123` |
| Tenant admin (3D-2U, Pro) | `/app` | `owner@3d-2u.com` / `tenant123` |
| Tenant admin (Nova, Starter) | `/app` | `admin@nova.test` / `tenant123` |
| Designer (3D-2U) | `/app` | `maya@3d-2u.com` / `designer123` |
| Customer widget — active | `/w/fk_demo_3d2u_public_key_01` | — |
| Customer widget — suspended tenant | `/w/fk_demo_legacy_public_key_03` | — |

### Embedding on a tenant's own site

The tenant pastes this on any page of e.g. `3d-2u.com` — their URL never changes:

```html
<div id="forma-intake"></div>
<script src="http://localhost:3000/embed.js" data-forma-key="fk_demo_3d2u_public_key_01" async></script>
```

`embed.js` injects an iframe of `/w/<key>`. When the subscription lapses (or the
platform admin suspends the tenant), the widget renders an "unavailable" state and
no AI calls run.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest — unit + multi-tenant isolation integration tests |
| `npm run db:up` / `db:down` | Start / stop Postgres container |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma migrate / seed / reset |

## Tests

```bash
npm test
```

- `tests/unit.test.ts` — confidence-tier derivation, pricing math, slug rules
- `tests/isolation.test.ts` — asserts no tenant-scoped read reaches another
  tenant's rows, that a customer token signed for tenant A cannot resolve
  tenant B's query, and that usage aggregates stay within a tenant

## Going to production (next steps)

1. Implement real adapters in `src/lib/adapters/` and set `USE_MOCK_ADAPTERS=false`
2. Stripe: subscription lifecycle + `past_due` / `canceled` webhooks → `tenant.status`
3. Real async queue (BullMQ/SQS) behind the `Job` model instead of inline calls
4. S3 for audio/image storage + encryption at rest; access logging for confidentiality
5. Whisper multipart upload on `/api/queries/:id/transcribe`
6. Embed-origin allow-listing enforcement + rate limiting on `POST /api/queries`
7. NDA-escalation workflow surface for tenant admins

## Layout

```
prisma/schema.prisma        data model (spec §4 + Job, NdaRequest, AuditLog, PlatformConfig)
prisma/seed.ts              demo data
src/lib/                    db, auth, rbac, plan limits, usage/cost, confidence, adapters
src/app/api/                REST route handlers (spec §7)
src/app/admin/(console)/    super admin console
src/app/app/(dash)/         tenant dashboard
src/app/w/[embedKey]/       customer widget
src/components/             UI primitives + widget state machine
```
