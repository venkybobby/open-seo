// Custom environment variable type definitions
// These extend the auto-generated Env interface from worker-configuration.d.ts

declare namespace Cloudflare {
  interface Env {
    R2: R2Bucket;
    OAUTH_KV: KVNamespace;

    AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;
    POSTHOG_PUBLIC_KEY?: string;
    POSTHOG_HOST?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    LOOPS_API_KEY?: string;
    LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID?: string;
    LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID?: string;

    // DataForSEO API Basic auth value (base64 of login:password)
    DATAFORSEO_API_KEY: string;

    /** e.g. agencyflowseo.com — enables {slug}.platform domain tenant routing */
    TENANT_PLATFORM_DOMAIN?: string;
    /** Fallback tenant slug when host does not match (default: `default`) */
    DEFAULT_TENANT_SLUG?: string;

    WEEKLY_REPORT_WORKFLOW: Workflow;

    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    APP_PUBLIC_URL?: string;

    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_PRICE_FREELANCER?: string;
    STRIPE_PRICE_AGENCY_STARTER?: string;
    STRIPE_PRICE_AGENCY_PRO?: string;
    STRIPE_PRICE_ENTERPRISE?: string;
  }
}

interface ImportMetaEnv {
  readonly AUTH_MODE?: "cloudflare_access" | "local_noauth" | "hosted";
  readonly POSTHOG_PUBLIC_KEY?: string;
  readonly POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
