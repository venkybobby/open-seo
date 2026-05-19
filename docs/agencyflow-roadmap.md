# AgencyFlow SEO — White-label roadmap

Foundation for turning OpenSEO into a multi-tenant, agency-branded SaaS.

## Phase 1 (implemented in repo)

- `tenants` + `organization_tenants` tables (`src/db/tenant.schema.ts`, migration `drizzle/0015_white_label_tenants.sql`)
- Host-based tenant resolution (`src/middleware/resolve-tenant.ts`)
- Request-scoped tenant on authenticated server functions (`src/middleware/ensureUser.ts`)
- Dynamic branding (`src/lib/branding.ts`, `TenantBrandingProvider`, `AppShell` brand mark)
- Env: `TENANT_PLATFORM_DOMAIN`, `DEFAULT_TENANT_SLUG` (see `.env.example`)

### Local setup

```bash
pnpm install
pnpm db:migrate:local
```

Create an agency tenant (example):

```sql
INSERT INTO tenants (id, slug, agency_name, primary_color, plan, status)
VALUES ('tenant_demo', 'acme', 'Acme SEO', '#22c55e', 'agency_starter', 'active');
```

Visit `acme.localhost:3001` when `TENANT_PLATFORM_DOMAIN=localhost` is set, or set `custom_domain` on the tenant row.

## Phase 2 (in progress)

- [x] `WeeklyReportWorkflow` + PDF email via Resend (`RESEND_API_KEY`, Monday cron)
- [x] Settings toggle for weekly reports (`weekly_report_subscriptions`)
- [x] Agency marketing page `web/src/routes/_marketing/for-agencies.tsx`
- [x] Launch checklist `docs/launch-checklist.md`
- [x] Stripe platform subscriptions on tenants (`docs/stripe-setup.md`)
- [x] Plan-based DataForSEO markup in `dataforseoClient`
- [ ] AI co-pilot route (MCP + project context)
- [ ] Client portal role (read-only guest)

## Phase 3

- Docker Compose enterprise tier
- Plan feature flags in `tenants.plan`
- Tenant-scoped PostHog groups

## Pricing reference

| Tier | Price/mo (annual) | Clients | DataForSEO markup |
|------|-------------------|---------|-------------------|
| Freelancer | $49 | 5 | 20% |
| Agency Starter | $149 | 25 | 25% |
| Agency Pro | $399 | Unlimited | 30% |
| Enterprise | $999+ | Unlimited | Custom |
