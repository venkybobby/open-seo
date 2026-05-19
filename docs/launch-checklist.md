# AgencyFlow SEO — Launch checklist

Use this before pointing **agencyflowseo.com** (or your brand domain) at production.

## 1. Infrastructure

- [ ] Run migrations: `pnpm db:migrate:local` (dev) and `pnpm db:migrate:prod` (production)
- [ ] Deploy app worker: `pnpm deploy`
- [ ] Deploy marketing site: `cd web && pnpm deploy` (worker `open-seo-landing`)
- [ ] Set `AUTH_MODE=hosted` on the app worker
- [ ] Configure `BETTER_AUTH_URL` / `APP_PUBLIC_URL` to your app origin (e.g. `https://app.agencyflowseo.com`)
- [ ] Add `TENANT_PLATFORM_DOMAIN` (e.g. `agencyflowseo.com`) for `{slug}.agencyflowseo.com` tenant routing
- [ ] Verify Cloudflare cron triggers: rank checks `*/15 * * * *`, weekly reports `0 14 * * 1` (Monday 14:00 UTC)

## 2. Email & reports

- [ ] Create [Resend](https://resend.com) account and verify sending domain
- [ ] Set worker secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (e.g. `reports@agencyflowseo.com`)
- [ ] Send a test report: enable rank tracking on a staging org, trigger `WeeklyReportWorkflow` manually or wait for Monday cron
- [ ] Confirm PDF attachment opens and branding matches tenant row (`tenants` table)
- [ ] Loops templates still configured for auth (`LOOPS_*` vars)

## 3. White-label tenants

- [ ] Insert first agency tenant (see `docs/agencyflow-roadmap.md` sample SQL)
- [ ] Map customer orgs: `organization_tenants` links each Better Auth org to a tenant
- [ ] Set `logo_url`, `primary_color`, optional `custom_domain` per tenant
- [ ] Smoke-test: visit subdomain or custom domain and confirm navbar brand + CSS primary color

## 4. Billing

- [ ] Autumn: org usage credits (`AUTUMN_SECRET_KEY`, `base-plan`, top-ups)
- [ ] Stripe platform: follow `docs/stripe-setup.md` (prices + webhook)
- [ ] Test Checkout from **Billing → Agency platform plan**
- [ ] Confirm plan-based DataForSEO markup (20% / 25% / 30% by `tenants.plan`)
- [ ] Project limits: Freelancer 5, Starter 25, Pro unlimited

## 5. Marketing site (`web/`)

- [ ] `/for-agencies` page live with AgencyFlow copy and CTAs → app sign-up
- [ ] Regenerate sitemap: `node web/scripts/generate-sitemap.js`
- [ ] DNS: `openseo.so` or your domain → landing worker; `app.` → app worker
- [ ] Newsletter `/api/subscribe` (Loops) tested
- [ ] Optional: replace hero video on `/for-agencies` with agency-branded dashboard screenshots

## 6. Product polish

- [ ] Settings → **Weekly SEO email** toggle tested (hosted mode only)
- [ ] Client portal / guest role (Phase 2 — not required for soft launch)
- [ ] PostHog: tenant-scoped groups for agency analytics
- [ ] Support email and status page linked from footer

## 7. Go-to-market (first 30 days)

- [ ] Landing headline A/B: “White-label SEO dashboards” vs “Stop paying $200/client for SEO tools”
- [ ] LinkedIn ads targeting “SEO agency owner” + retarget site visitors
- [ ] Posts in r/SEO, r/bigseo, agency Facebook groups (lead with open-source + margin story)
- [ ] Offer **$499 setup**: custom domain + 1h onboarding (from pricing add-on)
- [ ] Track: sign-ups, activated rank tracking, weekly report open rate, paid conversion

## 8. Legal & trust

- [ ] Update privacy/terms if you collect agency client data under your brand
- [ ] Data processing note: DataForSEO + Cloudflare + Resend subprocessors
- [ ] SOC2 / GDPR copy on enterprise tier (Enterprise $999+)

## Quick reference

| Asset | Path / URL |
|-------|------------|
| Agency landing | `/for-agencies` on marketing worker |
| Weekly reports code | `src/server/workflows/WeeklyReportWorkflow.ts` |
| Report opt-in | App → Settings → Weekly SEO email |
| Roadmap | `docs/agencyflow-roadmap.md` |

**Target:** 10–30 paying agencies in 90 days → $10k–30k MRR at Agency Starter ($149) with usage margin.
