#!/bin/sh
# Boot script for `Dockerfile.selfhost`.
#
# `vite preview` runs the worker bundle inside `workerd`, which reads its env
# from `dist/server/.dev.vars` (a dotenv file) — NOT from the host process
# environment. `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` only works under
# `vite dev`. So at container start we materialize the host env vars we care
# about into `.dev.vars` so workerd actually surfaces them via
# `cloudflare:workers` env().
#
# This script:
#   1. Writes a freshly-generated `dist/server/.dev.vars` from the runtime env.
#   2. Runs the D1 migrations against the persistent volume.
#   3. Execs `vite preview` on $PORT (or 3001 locally).

set -eu

VARS_FILE="dist/server/.dev.vars"
mkdir -p "$(dirname "$VARS_FILE")"
: > "$VARS_FILE"

# Whitelist of env vars to forward to workerd. Keep this in sync with
# `src/env.d.ts` and any other runtime-required variables. We deliberately do
# NOT forward arbitrary host vars (PATH, HOME, etc.) into the worker env.
WORKER_VARS="
AUTH_MODE
BETTER_AUTH_SECRET
BETTER_AUTH_URL
APP_PUBLIC_URL
ALLOWED_HOST
BYPASS_EMAIL_VERIFICATION
DATAFORSEO_API_KEY
TEAM_DOMAIN
POLICY_AUD
POSTHOG_PUBLIC_KEY
POSTHOG_HOST
LOOPS_API_KEY
LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID
LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID
RESEND_API_KEY
RESEND_FROM_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_FREELANCER
STRIPE_PRICE_AGENCY_STARTER
STRIPE_PRICE_AGENCY_PRO
STRIPE_PRICE_ENTERPRISE
AUTUMN_SECRET_KEY
TENANT_PLATFORM_DOMAIN
DEFAULT_TENANT_SLUG
NODE_ENV
"

written=0
for var in $WORKER_VARS; do
  # Use eval to read the env var value safely (printenv would also work but is
  # not POSIX-mandated to handle unset cleanly across shells).
  value=$(printenv "$var" 2>/dev/null || true)
  if [ -n "$value" ]; then
    # Escape backslashes and double-quotes for dotenv double-quoted form.
    escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '%s="%s"\n' "$var" "$escaped" >> "$VARS_FILE"
    written=$((written + 1))
  fi
done

echo "[start] wrote $written variables to $VARS_FILE"

pnpm run db:migrate:local

exec pnpm exec vite preview --host 0.0.0.0 --port "${PORT:-3001}"
