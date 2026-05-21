# Railway deployment guide

This deploys OpenSEO / AgencyFlow on [Railway](https://railway.com) using the
`Dockerfile.selfhost` image. Railway is suitable for the **self-hosted /
single-agency** mode, with the same trade-offs as Koyeb: **no Cloudflare crons
or workflows** (weekly reports + 15-min rank cron are Cloudflare-only).

For the full multi-tenant SaaS (crons, workflows, D1, edge), deploy to
Cloudflare Workers per [`koyeb-deploy.md`](koyeb-deploy.md#part-2--cloudflare-production-deploy-full-agencyflow).

## 1. Why not RAILPACK?

Railway's auto-detected RAILPACK config (`pnpm install && pnpm build`) does not
work for this app, because `pnpm build` emits a Cloudflare Worker bundle (via
`@cloudflare/vite-plugin`) and the code imports `cloudflare:workers`. Use the
included `Dockerfile.selfhost` instead — it runs the Worker bundle inside
`workerd` packaged in a Node 22 container and serves HTTP on `$PORT`.

## 2. Codified config

The repo ships [`railway.json`](../railway.json):

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.selfhost"
  },
  "deploy": {
    "runtime": "V2",
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/",
    "healthcheckTimeout": 30
  }
}
```

`sleepApplication: false` is important — sleeping replicas drop the SQLite D1
state until a request rehydrates them.

## 3. Service setup

1. Railway → New Project → **Deploy from GitHub repo** → `venkybobby/open-seo`.
2. Confirm Railway picked up `railway.json` (Builder = Dockerfile,
   Dockerfile = `Dockerfile.selfhost`).
3. **Add a Volume**:

   | Mount path | Size | Purpose |
   |------------|------|---------|
   | `/app/.wrangler` | ≥ 1 GB | Local D1 SQLite + applied migrations |

   Without this, **all data is lost on every redeploy**.

4. **Generate a domain** (`Settings → Networking → Generate Domain`) or attach
   a custom one. Railway sets `$PORT` automatically (usually `8080`) and the
   Dockerfile binds `vite preview` to that port. The Dockerfile intentionally
   does not declare `EXPOSE`, so Railway auto-detects the live listener and
   forwards traffic to it. If your Railway service was provisioned before this
   change, also clear / set **Settings → Networking → Target Port** to match
   `$PORT` (`8080`) — a stale `Target Port: 3001` will cause Caddy to 404
   instantly even when the app is healthy.

## 4. Environment variables

Set under `Variables` (use Railway secret references for keys):

### Minimum — local-no-auth self-host

| Variable | Value |
|----------|-------|
| `CLOUDFLARE_INCLUDE_PROCESS_ENV` | `true` |
| `AUTH_MODE` | `local_noauth` |
| `DATAFORSEO_API_KEY` | base64 `login:password` |
| `ALLOWED_HOST` | your Railway URL or custom domain |
| `VITE_SHOW_DEVTOOLS` | `false` |

### Optional — hosted multi-tenant on Railway

Only enable this if you've accepted that crons/workflows won't run. Weekly
reports and the rank-check loop will need manual triggers (or an external
scheduler hitting an admin endpoint).

| Variable | Notes |
|----------|-------|
| `AUTH_MODE` | `hosted` |
| `BETTER_AUTH_SECRET` | 32+ char random |
| `BETTER_AUTH_URL` | Railway URL (https) |
| `APP_PUBLIC_URL` | same |
| `AUTUMN_SECRET_KEY` | Autumn usage billing |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | see [`stripe-setup.md`](stripe-setup.md) |
| `STRIPE_PRICE_FREELANCER` / `_AGENCY_STARTER` / `_AGENCY_PRO` | Stripe price IDs |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | weekly report emails (manual trigger only) |
| `TENANT_PLATFORM_DOMAIN` | your apex domain |
| `LOOPS_API_KEY` + transactional IDs | optional, transactional auth emails |
| `POSTHOG_PUBLIC_KEY` | optional product analytics |

### Stripe webhook URL (hosted mode)

`https://<your-railway-domain>/api/stripe/webhook`

## 5. First deploy

- Build takes **5–10 min** (install + Vite build + tsc inside the container).
- Container start runs `pnpm db:migrate:local` against the mounted `/app/.wrangler`
  volume, then `vite preview --host 0.0.0.0 --port $PORT`.
- Health check at `/` should be green within ~30 s of start.

## 6. Post-deploy checklist

- [ ] App loads at the Railway URL
- [ ] `admin@localhost` works (`local_noauth`)
- [ ] DataForSEO-backed feature (keyword research) works
- [ ] Create a project, redeploy, project still present → volume verified
- [ ] If hosted: Stripe Checkout (test card `4242 4242 4242 4242`) updates the
      `tenants` row via the webhook
- [ ] **Do not expect** the Monday weekly email or the 15-min rank cron — those
      require Cloudflare Workers (see [`koyeb-deploy.md`](koyeb-deploy.md))

## 7. Rollback

Railway → Deployments → pick a previous green deploy → **Redeploy**. The
volume is preserved across rollbacks.

## 8. When to graduate to Cloudflare

Move the primary SaaS to Cloudflare Workers once any of these are true:

- You need the **Monday weekly report** to fire on its own.
- You need the **15-min rank-tracking cron**.
- You need **Cloudflare Workflows** (durable, retryable rank/audit/report jobs).
- You want D1 / KV / R2 at the edge instead of a single-region SQLite file.

In that case, follow Part 2 of [`koyeb-deploy.md`](koyeb-deploy.md) and keep
Railway only for the marketing site or a homelab instance.
