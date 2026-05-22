import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@/db";
import { z } from "zod";
import { createBaseAuthConfig } from "@/lib/auth-config";
import { getOrCreateDefaultHostedOrganization } from "@/server/auth/default-hosted-organization";
import {
  sendHostedPasswordResetEmail,
  sendHostedVerificationEmail,
  upsertHostedSignupContact,
} from "@/server/email/loops";

const hostedBaseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" && url.hostname === "localhost")
    );
  }, "BETTER_AUTH_URL must use https or localhost");

/**
 * Read an env var from `cloudflare:workers` env first, then fall back to
 * `process.env`. Belt-and-suspenders for self-hosted deployments where the
 * `cloudflare:workers` env shim under `vite preview` doesn't always surface
 * runtime-only variables set by the host platform (Railway/Koyeb/Fly).
 */
function readEnvVar(name: string): string | undefined {
  const fromEnv = Reflect.get(env, name);
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim();
  }
  const fromProcess =
    typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim() !== "") {
    return fromProcess.trim();
  }
  return undefined;
}

let bootDiagnosticsLogged = false;
function logBootDiagnosticsOnce() {
  if (bootDiagnosticsLogged) return;
  bootDiagnosticsLogged = true;
  const interesting = [
    "AUTH_MODE",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "APP_PUBLIC_URL",
    "BYPASS_EMAIL_VERIFICATION",
    "CLOUDFLARE_INCLUDE_PROCESS_ENV",
    "ALLOWED_HOST",
    "LOOPS_API_KEY",
    "RESEND_API_KEY",
  ];
  const visible: Record<string, string> = {};
  for (const name of interesting) {
    const v = readEnvVar(name);
    if (v) {
      visible[name] =
        name === "BETTER_AUTH_SECRET" ||
        name === "LOOPS_API_KEY" ||
        name === "RESEND_API_KEY"
          ? `set(len=${v.length})`
          : v;
    } else {
      visible[name] = "<unset>";
    }
  }
  console.log("[auth] boot diagnostics:", visible);
}

function createAuth() {
  logBootDiagnosticsOnce();
  const baseUrl = getHostedBaseUrl();
  const bypassEmail = isEmailVerificationBypassed();
  const baseAuthConfig = createBaseAuthConfig();

  const auth = betterAuth({
    baseURL: baseUrl,
    secret: getHostedSecret(),
    ...baseAuthConfig,
    emailAndPassword: {
      ...baseAuthConfig.emailAndPassword,
      requireEmailVerification: !bypassEmail,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendHostedPasswordResetEmail({
          email: user.email,
          resetUrl: url,
        });
      },
    },
    emailVerification: bypassEmail
      ? undefined
      : {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user, url }) => {
            await sendHostedVerificationEmail({
              email: user.email,
              confirmationUrl: url,
            });
          },
        },
    trustedOrigins: getTrustedOrigins(baseUrl),
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    plugins: [...baseAuthConfig.plugins, tanstackStartCookies()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            try {
              await upsertHostedSignupContact({
                userId: user.id,
                email: user.email,
                name: user.name,
              });
            } catch (error) {
              console.error("Failed to create Loops profile for signup:", {
                userId: user.id,
                email: user.email,
                error,
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            // Inject Better Auth's createOrganization here so the helper can
            // stay reusable without importing auth.ts and creating a cycle.
            const organizationId = await getOrCreateDefaultHostedOrganization(
              session.userId,
              (body) => auth.api.createOrganization({ body }),
            );

            return {
              data: {
                ...session,
                activeOrganizationId: organizationId,
              },
            };
          },
        },
      },
    },
  });

  return auth;
}

let authInstance: ReturnType<typeof createAuth> | null = null;

function getTrustedOrigins(baseUrl: string) {
  const trustedOrigins = [baseUrl];

  if (process.env.NODE_ENV !== "production") {
    trustedOrigins.push(
      "http://open-seo.localhost:1355",
      "http://*.open-seo.localhost:1355",
      "https://open-seo.localhost:1355",
      "https://*.open-seo.localhost:1355",
    );
  }

  return trustedOrigins;
}

export function getHostedBaseUrl() {
  const baseUrl =
    readEnvVar("BETTER_AUTH_URL") ?? readEnvVar("APP_PUBLIC_URL");

  if (!baseUrl) {
    throw new Error(
      "BETTER_AUTH_URL (or APP_PUBLIC_URL) is required in hosted mode",
    );
  }

  return hostedBaseUrlSchema.parse(baseUrl);
}

function getHostedSecret() {
  const secret = readEnvVar("BETTER_AUTH_SECRET");

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required in hosted mode");
  }

  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  return secret;
}

function hasHostedAuthEmailConfig() {
  const loopsVars = [
    "LOOPS_API_KEY",
    "LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID",
    "LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID",
  ];

  return loopsVars.every((name) => readEnvVar(name) !== undefined);
}

/**
 * Email verification is bypassed when:
 *   1. BYPASS_EMAIL_VERIFICATION is explicitly "true", OR
 *   2. No email provider (Loops) is configured. This makes hosted-mode work
 *      out of the box for self-hosters who haven't wired up an email service.
 *      Set BYPASS_EMAIL_VERIFICATION=false to force verification (and pair it
 *      with Loops vars).
 */
function isEmailVerificationBypassed(): boolean {
  const explicit = readEnvVar("BYPASS_EMAIL_VERIFICATION");
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return !hasHostedAuthEmailConfig();
}

/**
 * Detailed reason why hosted auth config is incomplete, so the API route can
 * surface a useful 500 body instead of "Missing Better Auth hosted
 * configuration". `null` means everything is configured.
 */
export function getHostedAuthConfigError(): string | null {
  logBootDiagnosticsOnce();

  try {
    getHostedBaseUrl();
  } catch (error) {
    return error instanceof Error ? error.message : "BETTER_AUTH_URL invalid";
  }

  try {
    getHostedSecret();
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "BETTER_AUTH_SECRET invalid";
  }

  // Email verification: either explicitly bypassed, or (default) auto-bypassed
  // when no Loops config exists. Either way, sign-up works.
  return null;
}

export function hasHostedAuthConfig() {
  return getHostedAuthConfigError() === null;
}

export function getAuth() {
  if (authInstance) {
    return authInstance;
  }

  authInstance = createAuth();

  return authInstance;
}
