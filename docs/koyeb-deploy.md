# AgencyFlow / OpenSEO — Testing & Koyeb deployment plan

This guide covers **pre-merge testing**, **production architecture**, and **deploying on [Koyeb](https://www.koyeb.com)** using the official Docker self-host image.

## Architecture decision (read first)

OpenSEO / AgencyFlow uses **Cloudflare-native** features for the full hosted SaaS:

| Feature | Cloudflare Workers | Koyeb (Docker) |
|---------|-------------------|----------------|
| D1 database | Remote D1 | Local D1 in volume (`.wrangler`) |
| Rank-check cron (`*/15 * * * *`) | Yes | **No** |
| Weekly report cron (Monday) | Yes | **No** |
| Cloudflare Workflows (rank/audit) | Yes | **No** |
| Better Auth `hosted` mode | Yes | Possible* |
| Stripe + Autumn + Resend | Yes | Possible* |
| `local_noauth` self-host | Yes | **Recommended on Koyeb** |

\*Hosted mode on Docker requires all secrets as env vars and a **persistent volume** for D1. Workflows and crons still need Cloudflare unless you add external schedulers later.

### Recommended split

| Component | Platform | Why |
|-----------|----------|-----|
| **Production SaaS app** (`app.yourdomain.com`) | **Cloudflare Workers** (`pnpm deploy`) | Crons, workflows, D1, full AgencyFlow |
| **Marketing site** (`yourdomain.com`, `/for-agencies`) | Cloudflare (`cd web && pnpm deploy`) **or** Koyeb | Static/worker landing |
| **Homelab / single-agency Docker** | **Koyeb** | Simple, one container, `local_noauth` |

---

## Part 1 — Pre-deploy testing (local)

### 1.1 Prerequisites

- Node 22+, `pnpm@10.30.1` (`corepack enable`)
- DataForSEO API key (base64 `login:password`)
- For hosted SaaS tests: Stripe test keys, Resend, Loops, Autumn keys (see `.env.example`)

### 1.2 Install and migrate

```bash
pnpm install
pnpm db:migrate:local
```

Migrations applied (in order):

- `0015_white_label_tenants.sql`
- `0016_weekly_reports.sql`
- `0017_stripe_tenant_billing.sql`

### 1.3 Automated tests

```bash
pnpm test:ci
pnpm types:check
pnpm lint
```

Key unit tests:

- `src/lib/branding.test.ts`
- `src/shared/billing.test.ts`
- `src/server/features/reports/weeklyReportSummary.test.ts`

### 1.4 Local dev (hosted mode)

Create `.env` / `.dev.vars` from `.env.example`:

```env
AUTH_MODE=hosted
BETTER_AUTH_SECRET=<32+ char random>
BETTER_AUTH_URL=http://localhost:3001
APP_PUBLIC_URL=http://localhost:3001
DATAFORSEO_API_KEY=<base64>
AUTUMN_SECRET_KEY=<optional for usage billing>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_FREELANCER=price_...
STRIPE_PRICE_AGENCY_STARTER=price_...
STRIPE_PRICE_AGENCY_PRO=price_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=reports@yourdomain.com
TENANT_PLATFORM_DOMAIN=localhost
```

```bash
pnpm dev
```

### 1.5 Manual test matrix (hosted)

| # | Area | Steps | Expected |
|---|------|-------|----------|
| 1 | Auth | Sign up / sign in | Session + default org |
| 2 | Tenant branding | Insert tenant + `organization_tenants` link; set `TENANT_PLATFORM_DOMAIN` | Navbar shows agency name / logo |
| 3 | Stripe platform | Billing → Agency platform plan → Checkout (4242…) | `tenants.subscription_status` = `active` |
| 4 | Autumn usage | Billing → base plan + top-up | Rank check consumes credits |
| 5 | Rank tracking | Add domain + keywords → Run check | Positions stored |
| 6 | Weekly reports | Settings → enable; Monday cron or manual workflow | Email with PDF (Resend) |
| 7 | Plan limits | Freelancer tenant + 6th project | `PAYMENT_REQUIRED` / limit error |
| 8 | Markup | Compare usage charge vs raw DataForSEO cost | 20–30% by plan |

Stripe webhook locally:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

### 1.6 Docker smoke test (Koyeb-like)

```bash
cp .env.example .env
# Set DATAFORSEO_API_KEY, optional ALLOWED_HOST
docker compose up -d --build
open http://localhost:3001
```

Default compose uses `AUTH_MODE=local_noauth` (no Stripe/Autumn required).

---

## Part 2 — Cloudflare production deploy (full AgencyFlow)

Use this for the **primary SaaS** before or alongside Koyeb.

### 2.1 Cloudflare resources

1. D1 database `open-seo` (see `wrangler.jsonc`)
2. R2, KV, OAuth KV bindings
3. Workflows: `site-audit-workflow`, `rank-check-workflow`, `weekly-report-workflow`
4. Cron triggers: `*/15 * * * *`, `0 14 * * 1`

### 2.2 Secrets (wrangler)

```bash
wrangler secret put AUTH_MODE              # hosted
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL        # https://app.yourdomain.com
wrangler secret put APP_PUBLIC_URL
wrangler secret put DATAFORSEO_API_KEY
wrangler secret put AUTUMN_SECRET_KEY
wrangler secret put LOOPS_API_KEY
wrangler secret put LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID
wrangler secret put LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PRICE_FREELANCER
wrangler secret put STRIPE_PRICE_AGENCY_STARTER
wrangler secret put STRIPE_PRICE_AGENCY_PRO
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put TENANT_PLATFORM_DOMAIN
wrangler secret put POSTHOG_PUBLIC_KEY
```

### 2.3 Deploy commands

```bash
pnpm db:migrate:prod
pnpm deploy
cd web && pnpm install && pnpm deploy
```

### 2.4 DNS

| Host | Target |
|------|--------|
| `app.yourdomain.com` | Cloudflare Worker (open-seo) |
| `yourdomain.com` / `www` | Landing worker (`open-seo-landing`) or Koyeb |
| `{agency}.yourdomain.com` | Same app worker + `TENANT_PLATFORM_DOMAIN` |

### 2.5 External webhooks

| Service | URL |
|---------|-----|
| Stripe | `https://app.yourdomain.com/api/stripe/webhook` |
| Autumn | (dashboard config) |

See also: [`launch-checklist.md`](launch-checklist.md), [`stripe-setup.md`](stripe-setup.md).

---

## Part 3 — Koyeb deployment (Docker)

### 3.1 What Koyeb runs

Koyeb runs the **Docker self-host** stack:

- Image: `ghcr.io/every-app/open-seo:latest` (or your fork’s GHCR image after CI)
- Dockerfile: `Dockerfile.selfhost`
- Port: **3001** (HTTP)
- **Volume required** for `open_seo_data` → `/app/.wrangler` (SQLite D1 + local state)

### 3.2 Create the Koyeb service

**Option A — Git-driven (recommended)**

1. Push this branch to GitHub (`venkybobby/open-seo` or your fork).
2. Koyeb → Create App → GitHub → select repo.
3. Builder: **Dockerfile** → `Dockerfile.selfhost`
4. Port: `3001`
5. Instance: `small` or larger (512MB+ RAM; build step needs memory).
6. Regions: choose closest to users (e.g. `was` / `fra`).

**Option B — Pre-built image**

1. Koyeb → Docker → Image: `ghcr.io/every-app/open-seo:latest`
2. Same port and volume as below.

### 3.3 Persistent volume (required)

In Koyeb → Service → **Volumes**:

| Mount path | Size | Purpose |
|------------|------|---------|
| `/app/.wrangler` | ≥ 1 GB | D1 SQLite + local migrations |

Without this, **data is lost on every redeploy**.

### 3.4 Environment variables (Koyeb UI → Variables)

**Minimum (self-host / homelab):**

| Variable | Value |
|----------|--------|
| `CLOUDFLARE_INCLUDE_PROCESS_ENV` | `true` |
| `AUTH_MODE` | `local_noauth` |
| `PORT` | `3001` |
| `DATAFORSEO_API_KEY` | *(secret)* |
| `ALLOWED_HOST` | `your-app-xxx.koyeb.app` or custom domain |
| `VITE_SHOW_DEVTOOLS` | `false` |

**Optional AgencyFlow on Docker (limited — no crons/workflows):**

| Variable | Value |
|----------|--------|
| `AUTH_MODE` | `hosted` |
| `BETTER_AUTH_SECRET` | *(secret)* |
| `BETTER_AUTH_URL` | `https://your-app-xxx.koyeb.app` |
| `APP_PUBLIC_URL` | same as above |
| `AUTUMN_SECRET_KEY` | *(secret)* |
| `STRIPE_*` | per [`stripe-setup.md`](stripe-setup.md) |
| `RESEND_*` | weekly reports (manual trigger only on Koyeb) |
| `TENANT_PLATFORM_DOMAIN` | your root domain |

Use Koyeb **secrets** for all API keys.

### 3.5 Health check

| Setting | Value |
|---------|--------|
| Path | `/` |
| Port | `3001` |
| Interval | 30s |

First deploy takes **5–10 minutes** (install + build + migrate inside container).

### 3.6 Custom domain on Koyeb

1. Koyeb → Domains → Add `app.yourdomain.com`
2. CNAME to Koyeb-provided target
3. Set `ALLOWED_HOST=app.yourdomain.com`
4. Redeploy

### 3.7 Example `koyeb.yaml` (optional IaC)

```yaml
# koyeb.yaml — adjust name/region; set secrets in Koyeb dashboard
name: agencyflow-open-seo
services:
  - name: open-seo
    docker:
      dockerfile: Dockerfile.selfhost
    instance_type: small
    regions:
      - was
    ports:
      - port: 3001
        protocol: http
    volumes:
      - mount_path: /app/.wrangler
        size_gb: 2
    env:
      - key: CLOUDFLARE_INCLUDE_PROCESS_ENV
        value: "true"
      - key: AUTH_MODE
        value: local_noauth
      - key: PORT
        value: "3001"
      - key: VITE_SHOW_DEVTOOLS
        value: "false"
      - key: ALLOWED_HOST
        value: your-app.yourdomain.com
    secrets:
      - key: DATAFORSEO_API_KEY
        secret: dataforseo-api-key
    healthchecks:
      - port: 3001
        http_path: /
        interval: 30
```

Deploy with Koyeb CLI: `koyeb service create --config koyeb.yaml` (after secrets exist).

### 3.8 Koyeb limitations checklist

After deploy, verify:

- [ ] App loads at Koyeb URL
- [ ] `admin@localhost` works (`local_noauth`)
- [ ] Keyword research / rank tracking (manual) works with DataForSEO key
- [ ] Volume persists data across restart
- [ ] **Do not expect** Monday weekly emails or 15-min rank cron on Koyeb
- [ ] For full SaaS, use Cloudflare deploy (Part 2)

---

## Part 4 — Post-deploy validation

### 4.1 Cloudflare (full SaaS)

- [ ] Sign-up and email verification (Loops)
- [ ] Stripe Checkout + webhook updates `tenants`
- [ ] Rank cron runs (Workers → Logs / Cron)
- [ ] Weekly report workflow (Monday or manual trigger)
- [ ] `/for-agencies` marketing page live

### 4.2 Koyeb (Docker)

- [ ] Health check green
- [ ] D1 data survives redeploy (create project, redeploy, project still exists)
- [ ] `ALLOWED_HOST` matches public URL (no host header errors)

### 4.3 Monitoring

- Koyeb: Metrics + logs in service dashboard
- Cloudflare: Workers observability + cron invocation logs
- PostHog (optional): hosted analytics events

---

## Part 5 — Rollback

| Platform | Action |
|----------|--------|
| Cloudflare | `wrangler rollback` or redeploy previous git tag |
| Koyeb | Redeploy previous image digest / git commit |
| Database | D1: backup before migrate; local Docker: snapshot volume |

---

## Quick command reference

```bash
# Local
pnpm install && pnpm db:migrate:local && pnpm dev

# Test
pnpm test:ci && pnpm types:check

# Cloudflare production
pnpm db:migrate:prod && pnpm deploy

# Docker / Koyeb local test
docker compose up -d --build

# Marketing
cd web && pnpm install && pnpm build && pnpm deploy
```

## Related docs

- [`agencyflow-roadmap.md`](agencyflow-roadmap.md)
- [`launch-checklist.md`](launch-checklist.md)
- [`stripe-setup.md`](stripe-setup.md)
- [`SELF_HOSTING_DOCKER.md`](SELF_HOSTING_DOCKER.md)
