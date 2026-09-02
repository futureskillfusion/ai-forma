# Deploy AI Forma — Vercel + Neon (free)

Live in ~10 minutes, no paid API keys (runs in mock + free image mode).
Both Vercel Hobby and Neon free tier have **no trial expiry**.

## 1. Push the code (dev — already done)

```bash
git remote add origin https://github.com/futureskillfusion/ai-forma.git
git push -u origin main
```

## 2. Database — Neon

1. Go to **neon.tech** → sign up (GitHub is fine) → **Create project** (name: `ai-forma`, region near you).
2. On the project dashboard, open **Connection Details**. You need **two** strings:
   - **Pooled** connection (has `-pooler` in the host) → this is `DATABASE_URL`
   - **Direct** connection (toggle off "Pooled connection") → this is `DIRECT_URL`
   Copy both.

## 3. Hosting — Vercel

1. Go to **vercel.com** → sign in with the **futureskillfusion** GitHub account.
2. **Add New → Project → Import `futureskillfusion/ai-forma`.**
3. Before clicking Deploy, open **Environment Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` | Neon **direct** string |
   | `AUTH_SECRET` | 32+ random chars — run `openssl rand -hex 32` |
   | `USE_MOCK_ADAPTERS` | `true` |
   | `IMAGE_PROVIDER` | `pollinations` |
   | `NEXT_PUBLIC_APP_URL` | leave blank for now |

4. Click **Deploy**. The build runs `prisma migrate deploy`, so the database
   tables are created automatically.
5. After it finishes, Vercel shows the URL (e.g. `https://ai-forma.vercel.app`).
   Put that into `NEXT_PUBLIC_APP_URL` (Project → Settings → Environment Variables)
   and **Redeploy** once.

## 4. Seed the demo data (once)

Migrations create empty tables. To get the demo tenants + logins, run the seed
locally against the Neon **direct** URL:

```bash
cd "E:/Modeling App"
DATABASE_URL="<Neon direct URL>" DIRECT_URL="<Neon direct URL>" npm run db:seed
```

## 5. Log in

| Surface | URL | Credentials |
|---|---|---|
| Platform admin | `/admin` | `admin@systematicit.io` / `superadmin123` |
| Tenant admin | `/app` | `owner@3d-2u.com` / `tenant123` |
| Customer widget | `/w/fk_demo_3d2u_public_key_01` | — |

> Change or remove the demo super-admin before real use.

## Notes

- Local dev is unchanged: `DIRECT_URL` in `.env` is set to the same value as
  `DATABASE_URL` (local Postgres has no pooler).
- Real images: `IMAGE_PROVIDER=huggingface` + `HUGGINGFACE_API_TOKEN`, or a paid
  provider later.
- `USE_MOCK_ADAPTERS=false` once real LLM / Stripe / email / calendar keys exist.
- Custom domain (`viewrec.com`): Vercel **Settings → Domains**, follow the DNS
  instructions, then update `NEXT_PUBLIC_APP_URL`.
