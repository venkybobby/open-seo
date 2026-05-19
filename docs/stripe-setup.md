# Stripe platform billing setup

Agency tenants subscribe via **Stripe Checkout**. Organization-level **Autumn** credits remain for DataForSEO usage.

## 1. Create products in Stripe

In [Stripe Dashboard → Products](https://dashboard.stripe.com/products), create recurring prices:

| Plan | Suggested price | Env var |
|------|-----------------|---------|
| Freelancer | $49/mo | `STRIPE_PRICE_FREELANCER` |
| Agency Starter | $149/mo | `STRIPE_PRICE_AGENCY_STARTER` |
| Agency Pro | $399/mo | `STRIPE_PRICE_AGENCY_PRO` |
| Enterprise | Custom | `STRIPE_PRICE_ENTERPRISE` |

Copy each **Price ID** (`price_...`).

## 2. Worker secrets

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PRICE_FREELANCER
wrangler secret put STRIPE_PRICE_AGENCY_STARTER
wrangler secret put STRIPE_PRICE_AGENCY_PRO
```

Local `.env` / `.dev.vars` (same keys).

## 3. Webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint  
2. URL: `https://YOUR_APP_HOST/api/stripe/webhook`  
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

Local testing:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

## 4. Test flow

1. `pnpm db:migrate:local`
2. Insert a non-default tenant and link your org (`organization_tenants`)
3. Set Stripe env vars
4. Open **Billing** → **Agency platform plan** → choose a tier
5. Complete Checkout (test card `4242…`)
6. Confirm `tenants.subscription_status` = `active` and plan updated

The `default` tenant skips platform billing (existing OpenSEO hosted users).

## 5. Two-layer billing

| Layer | Provider | Customer ID |
|-------|----------|-------------|
| Platform (white-label) | Stripe | `tenants.stripe_customer_id` |
| SEO API usage | Autumn | `organizationId` |

Both are required in hosted mode when Stripe is configured.
