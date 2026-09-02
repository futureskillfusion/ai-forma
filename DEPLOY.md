# Deploy AI Forma (Railway) — quick path

Live in ~10 minutes, no paid API keys (runs in mock + free image mode).

## 1. Push the code (done by dev)

```bash
git remote add origin https://github.com/futureskillfusion/ai-forma.git
git push -u origin main
```

## 2. Railway

1. Go to **railway.app** → sign in with the **futureskillfusion** GitHub account.
2. **New Project → Deploy from GitHub repo → `futureskillfusion/ai-forma`.**
3. In the project, **+ New → Database → PostgreSQL**. Railway creates it and exposes
   `DATABASE_URL` automatically.
4. Open the **web service → Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `AUTH_SECRET` | a 32+ char random string — run `openssl rand -hex 32` |
   | `NEXT_PUBLIC_APP_URL` | your Railway URL, e.g. `https://ai-forma-production.up.railway.app` (set after the first deploy gives you the domain, then redeploy) |
   | `USE_MOCK_ADAPTERS` | `true` |
   | `IMAGE_PROVIDER` | `pollinations` (or `huggingface` + `HUGGINGFACE_API_TOKEN`) |

5. **Settings → Networking → Generate Domain.** Copy that URL into `NEXT_PUBLIC_APP_URL`
   above and redeploy.

The `start` script runs `prisma migrate deploy` on every boot, so the database schema
is created automatically on the first deploy.

## 3. Seed the demo data (once)

The migrations create empty tables. To get the demo tenants + logins:

- In Railway, open the **Postgres service → Connect** and copy its **public**
  `DATABASE_URL`.
- Locally:

  ```bash
  DATABASE_URL="<paste the Railway public URL>" npm run db:seed
  ```

That inserts the super admin, demo tenants, and a sample journey.

## 4. Log in

| Surface | URL | Credentials |
|---|---|---|
| Platform admin | `/admin` | `admin@systematicit.io` / `superadmin123` |
| Tenant admin | `/app` | `owner@3d-2u.com` / `tenant123` |
| Customer widget | `/w/fk_demo_3d2u_public_key_01` | — |

> Change or remove the demo super-admin before real use.

## Going further

- Real images: set `IMAGE_PROVIDER=fal` (adapter TBD) or `huggingface` + token.
- `USE_MOCK_ADAPTERS=false` once real LLM / Stripe / email / calendar keys are set.
- Custom domain: Railway **Settings → Networking → Custom Domain**, then point the
  domain's DNS as instructed and update `NEXT_PUBLIC_APP_URL`.
