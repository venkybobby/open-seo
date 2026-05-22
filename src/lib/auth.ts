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

function createAuth() {
  const baseUrl = getHostedBaseUrl();
  const bypassEmail = Reflect.get(env, "BYPASS_EMAIL_VERIFICATION") === "true";
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
  const baseUrl = env.BETTER_AUTH_URL?.trim();

  if (!baseUrl) {
    throw new Error("BETTER_AUTH_URL is required in hosted mode");
  }

  return hostedBaseUrlSchema.parse(baseUrl);
}

function getHostedSecret() {
  const secret = env.BETTER_AUTH_SECRET?.trim();

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

  return loopsVars.every((name) => {
    const value: unknown = Reflect.get(env, name);
    return typeof value === "string" && value.trim() !== "";
  });
}

/**
 * Detailed reason why hosted auth config is incomplete, so the API route can
 * surface a useful 500 body instead of "Missing Better Auth hosted
 * configuration". `null` means everything is configured.
 */
export function getHostedAuthConfigError(): string | null {
  let baseUrl: string;
  try {
    baseUrl = getHostedBaseUrl();
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

  const bypassRaw = Reflect.get(env, "BYPASS_EMAIL_VERIFICATION");
  const bypass = bypassRaw === "true";

  if (!bypass && !hasHostedAuthEmailConfig()) {
    const missing = [
      "LOOPS_API_KEY",
      "LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID",
      "LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID",
    ].filter(
      (name) =>
        typeof Reflect.get(env, name) !== "string" ||
        (Reflect.get(env, name) as string).trim() === "",
    );
    return `Email verification is enabled but Loops is not fully configured. Either set BYPASS_EMAIL_VERIFICATION=true (current value: ${
      bypassRaw === undefined ? "unset" : JSON.stringify(bypassRaw)
    }) for testing, or set the missing Loops vars: ${missing.join(", ")}. baseURL=${baseUrl}`;
  }

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
