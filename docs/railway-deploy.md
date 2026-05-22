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
| `ALLOWED_HOST` | your public Railway / custom domain (see below) |
| `VITE_SHOW_DEVTOOLS` | `false` |

`ALLOWED_HOST` accepts:

- **A single host** — `open-seo-production-59ac.up.railway.app`
- **Multiple hosts, comma-separated** — `app.openseo.so,staging.openseo.so`
- **`*`** — allow any Host header (only safe behind a trusted proxy that
  rewrites/strips it)

You do **not** need to add `healthcheck.railway.app` — `vite.config.ts`
always whitelists it (along with `localhost` / `127.0.0.1`) so Railway's
internal healthchecks pass regardless of what `ALLOWED_HOST` is set to.
Forgetting this previously caused every deploy to flap as "service
unavailable" while the app itself was healthy on `:$PORT`.

### Optional — hosted multi-tenant on Railway

Only enable this if you've accepted that crons/workflows won't run. Weekly
reports and the rank-check loop will need manual triggers (or an external
scheduler hitting an admin endpoint).

> **Important:** `AUTH_MODE` is read by both the **server at runtime** and the
> **client bundle at image-build time**. Railway automatically forwards every
> service Variable as a Docker build arg, and `Dockerfile.selfhost` declares
> `ARG AUTH_MODE` (default `local_noauth`). After flipping `AUTH_MODE` you
> must **Deploy Latest Commit** (a full rebuild) — not just a Restart — or
> the client bundle will still think it's in `local_noauth` mode.

#### Required (the only two)

| Variable | Notes |
|----------|-------|
| `AUTH_MODE` | `hosted` |
| `BETTER_AUTH_SECRET` | 32+ char random (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |

`BETTER_AUTH_URL` is auto-derived from `APP_PUBLIC_URL` (or the request host)
if not set. `BYPASS_EMAIL_VERIFICATION` defaults to `true` whenever no email
provider is configured, so sign-up works out of the box without Loops/Resend.

If the auth route returns a 500, the response body now tells you which gate
failed (e.g. `BETTER_AUTH_SECRET must be at least 32 characters`). You can
also check the Deploy Logs for a one-time `[auth] boot diagnostics:` line
listing every auth-relevant variable the worker can actually see.

#### Optional

| Variable | Notes |
|----------|-------|
| `BETTER_AUTH_URL` | Override auto-derivation. Use the Railway URL (https), no trailing slash |
| `APP_PUBLIC_URL` | Same as `BETTER_AUTH_URL` — used by other features (Stripe, weekly emails) |
| `BYPASS_EMAIL_VERIFICATION` | `true` to force-skip verification, `false` to require it (and you must configure Loops too) |
| `AUTUMN_SECRET_KEY` | Autumn usage billing (optional unless using DataForSEO credit metering) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | see [`stripe-setup.md`](stripe-setup.md) |
| `STRIPE_PRICE_FREELANCER` / `_AGENCY_STARTER` / `_AGENCY_PRO` | Stripe price IDs |
| `LOOPS_API_KEY` + `LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID` + `LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID` | transactional auth emails |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | weekly report emails (manual trigger only) |
| `TENANT_PLATFORM_DOMAIN` | your apex domain |
| `POSTHOG_PUBLIC_KEY` | product analytics |

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
